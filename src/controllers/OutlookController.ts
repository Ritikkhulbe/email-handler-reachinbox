import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import { connection, redisGetToken } from '../middlewares/redis.middleware';
import { createConfig } from '../helpers/utils';
import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import OpenAI from 'openai';
import session from 'express-session';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_SECRECT_KEY });

const clientId = process.env.AZURE_CLIENT_ID!;
const clientSecret = process.env.AZURE_CLIENT_SECRET!;
const redirectUri = "http://localhost:3000/outlook/callback";
const scopes = ["user.read", "Mail.Read", "Mail.Send"];

const ccaConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/common`,
    clientSecret,
  },
};

const cca = new ConfidentialClientApplication(ccaConfig);

declare module 'express-session' {
  interface SessionData {
    accessToken?: string;
  }
}

const signin = (req: Request, res: Response): void => {
  const authCodeUrlParameters = {
    scopes,
    redirectUri,
  };

  cca.getAuthCodeUrl(authCodeUrlParameters).then((response) => {
    res.redirect(response);
  }).catch((error) => {
    console.error("Error generating auth code URL:", error.message);
    res.status(500).send("Error generating auth code URL.");
  });
};

let accessToken: string;

const callback = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    res.status(400).send("Authorization code missing.");
    return;
  }

  try {
    const tokenRequest = {
      clientId,
      code,
      scopes,
      redirectUri,
      clientSecret: clientSecret,
    };
    console.log("Token Request:", tokenRequest);
    const response = await cca.acquireTokenByCode(tokenRequest);
    req.session.accessToken = response.accessToken;

    accessToken = response.accessToken;
    console.log(accessToken);
    res.status(200).send({ msg: "user is authorized" });
  } catch (error: any) {
    console.error("Error exchanging authorization code:", error.message);
    res.status(500).send("Error exchanging authorization code.");
  }
};

const getUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const url = `https://graph.microsoft.com/v1.0/me`;
    const token = accessToken;

    if (!token) {
      res.send("Token not found, Please login again to get token");
      return;
    }

    const config = createConfig(url, token);
    const response = await axios(config);
    connection.setex(response.data.mail, 3600, token);

    res.json(response.data);
  } catch (error: any) {
    console.log("Can't get user email data ", error.message);
    res.send(error.message);
  }
};

const getMails = async (req: Request, res: Response): Promise<void> => {
  try {
    const url = `https://graph.microsoft.com/v1.0/me/messages?maxResults=50`;
    const token = await redisGetToken(req.params.email);

    if (!token) {
      res.send("Token not found, Please login again to get token");
      return;
    }

    const config = createConfig(url, token);
    const response = await axios(config);
    res.json(response.data);
  } catch (error: any) {
    res.send(error.message);
    console.log("Can't get emails ", error.message);
  }
};

const readMail = async (req: Request, res: Response): Promise<void> => {
  try {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${req.params.message}`;
    const token = await redisGetToken(req.params.email);

    if (!token) {
      res.send("Token not found, Please login again to get token");
      return;
    }

    const config = createConfig(url, token);
    const response = await axios(config);
    const data = response.data;
    res.json(data);
  } catch (error: any) {
    res.send(error.message);
    console.log("Can't read mail ", error.message);
  }
};

const sendMail = async (data: any, token: string): Promise<void> => {
  try {
    if (!token) {
      throw new Error("Token not found, please login again to get token");
    }

    let emailContent = "";
    let subject = "";
    if (data.label === "Interested") {
      emailContent = `If the email mentions they are interested, do not generate any recipient's name instead use Dear user, your reply should give this advertisement i have express some key points below user then and create good reply for advertisement it should render on email in bullet points
      
      We're excited to share with you how our product can benefit you:
      - Secure Mailing: Our platform offers end-to-end encryption to ensure your emails remain private and secure.
      - Automated Emails: Easily automate your email workflows by setting timers and triggers. Schedule emails to be sent at specific times or based on user actions.
      - Customizable Templates: Create personalized email templates and automate repetitive tasks, saving you time and effort.

      Would you like to learn more about how our platform can streamline your email communication? Feel free to reply to this email.`;
      subject = `User is : ${data.label}`;
    } else if (data.label === "Not Interested") {
      emailContent = `If the email mentions they are not interested, create a reply where we should ask them for feedback on why they are not interested. do not generate any recipient's name instead use Dear user. Write a small text on the above request in around 100-150 words`;
      subject = `User is : ${data.label}`;
    } else if (data.label === "More Information") {
      emailContent = `If the email mentions they are interested to know more, your reply should give them more information about this product. Here are some of its key features:
      
      Thank you for expressing interest in our product! We're thrilled to share more details with you:
      - Google Authentication: Allow users to authenticate using their Google accounts.
      - View User Profile: Retrieve and display user profile information such as name, email, and profile picture.
      - View All Drafts: Fetch and display a list of all draft emails associated with the user's email address.
      - Read Specific Email: Retrieve and display the content of a specific email using its ID.
      - List Mails: Fetch and display a list of all emails associated with the user's email address.
      - Send Email with Label: Allow users to send emails with a specified label (e.g., "Interested", "Not Interested", "More Information").`;
      subject = `User is : ${data.label}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0301",
      max_tokens: 350,
      temperature: 0.5,
      messages: [
        {
          role: "user",
          content: emailContent,
        },
      ],
    });
    if(!response.choices[0].message.content) throw new Error("Content not found");
    const [heading, features, benefits] = response.choices[0].message.content.split("\n\n");
    const headingHTML = `<h2>${heading}</h2>`;
    const featuresHTML = `<ul>${features.split("\n").map((feature: string) => `<li>${feature}</li>`).join("")}</ul>`;
    const benefitsHTML = `<ul>${benefits.split("\n").map((feature: string) => `<li>${feature}</li>`).join("")}</ul>`;

    const mailOptions = {
      message: {
        subject: subject,
        body: {
          contentType: "HTML",
          content: `
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 10px; ">
              ${headingHTML}
              ${featuresHTML}
              ${benefitsHTML}
            </div>`,
        },
        toRecipients: [
          {
            emailAddress: {
              address: data.to,
            },
          },
        ],
      },
      saveToSentItems: false,
    };

    const url = "https://graph.microsoft.com/v1.0/me/sendMail";
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const sendMailResponse = await axios.post(url, mailOptions, { headers });
    return sendMailResponse.data;
  } catch (error: any) {
    throw new Error("Can't send email: " + error.message);
  }
};

export {
  getUser,
  signin,
  callback,
  getMails,
  readMail,
  sendMail,
};
