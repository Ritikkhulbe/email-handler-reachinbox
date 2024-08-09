import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { createConfig } from '../helpers/utils';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { connection } from '../middlewares/redis.middleware';
import OpenAI from 'openai';

dotenv.config();

export const googleRouter = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_SECRECT_KEY as string });

// Google OAuth2 Client
const oAuth2Client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

const scopes = ["https://mail.google.com"];

googleRouter.get("/auth/google", (req: Request, res: Response) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
  });
  console.log(authUrl);
  res.redirect(authUrl);
});

let accessToken: string;

googleRouter.get("/oauth2callback", async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).send("Authorization code missing.");
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    const { access_token, refresh_token, scope } = tokens;
    console.log(accessToken, refresh_token);
    if(access_token) accessToken = access_token;

    if (scope?.includes(scopes.join(" "))) {
      res.send("Restricted scopes test passed.");
    } else {
      res.send("Restricted scopes test failed: Scopes are not restricted.");
    }
  } catch (error) {
    console.error("Error exchanging authorization code:", (error as Error).message);
    res.status(500).send("Error exchanging authorization code.");
  }
});

// Get user profile details
export const getUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const url = `https://gmail.googleapis.com/gmail/v1/users/${req.params.email}/profile`;

    const token = accessToken;
    connection.setex(req.params.email, 3600, token);

    if (!token) {
      res.send("Token not found, please login again to get token");
      return;
    }

    const config: AxiosRequestConfig = createConfig((url), token);
    const response: AxiosResponse = await axios(config);

    res.json(response.data);
  } catch (error) {
    console.error("Can't get user email data", (error as Error).message);
    res.send((error as Error).message);
  }
};

interface SendMailData {
  from: string;
  to: string;
  label: string;
}

export const sendMail = async (data: SendMailData, token: string): Promise<string | undefined> => {
  try {
    if (!token) {
      throw new Error("Token not found, please login again to get token");
    }

    const emailContent = `dont use any name instead use dear user.here you have to create advertisement mail, your reply should provide an enticing advertisement for our ReachInbox platform. Highlight the key features and benefits to capture their interest and encourage them to learn more. Here's a suggested prompt:\n\n'Hello!\n\nWe're thrilled to introduce you to ReachInbox – the ultimate email management platform designed to streamline your communication workflows and boost your productivity.\n\nDiscover how ReachInbox can transform your email experience:\n\n- **Secure Mailing:** Rest assured that your emails are protected with state-of-the-art encryption, keeping your communication private and secure.\n\n- **Automated Emails:** Say goodbye to manual tasks! With ReachInbox, you can automate your email workflows, schedule emails, and set triggers to send messages at the perfect time.\n\n- **Customizable Templates:** Personalize your emails effortlessly! Create stunning templates tailored to your brand and audience, saving you time and effort.\n\nReady to supercharge your email productivity? Reply to this email to learn more about ReachInbox and take your communication to the next level.\n\nDon't miss out on this opportunity to revolutionize your inbox with ReachInbox. Get started today! . give this form of containers heading, features and benefits`;

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

    const content = response.choices[0]?.message?.content;
    console.log(content);

    const mailOptions = {
      from: data.from,
      to: data.to,
      subject: `${data.label} of ReachInbox`,
      text: `${data.label} of ReachInbox`,
      html: `
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 10px; text-align: center; font-family: Arial, sans-serif;">
          <h2 style="color: #333;">Exciting Offer from ReachInbox!</h2>
          <p style="font-size: 16px; color: #666;">Dear valued customer,</p>
          <p style="font-size: 16px; color: #666;">${content}</p>
          <p style="font-size: 16px; color: #666;">Best regards,</p>
          <p style="font-size: 16px; color: #666;"><strong>Shraddha Gawde</strong><br>ReachInbox</p>
        </div>`
    };

    const emailData = {
      raw: Buffer.from(
        [
          'Content-type: text/html;charset=iso-8859-1',
          'MIME-Version: 1.0',
          `from: ${data.from}`,
          `to: ${data.to}`,
          `subject: ${mailOptions.subject}`,
          `text: ${mailOptions.text}`,
          `html: ${mailOptions.html}`,
        ].join('\n')
      ).toString('base64')
    };

    const sendMessageResponse = await axios.post(`https://gmail.googleapis.com/gmail/v1/users/${data.from}/messages/send`, emailData, {
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${token}`
      }
    });

    // Modify label for the sent email
    const labelUrl = `https://gmail.googleapis.com/gmail/v1/users/${data.from}/messages/${sendMessageResponse.data.id}/modify`;
    const labelConfig: AxiosRequestConfig = {
      method: 'POST',
      url: labelUrl,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        addLabelIds: ["Label_4"]
      }
    };
    await axios(labelConfig);

    return sendMessageResponse.data.id;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Can't send email: " + (error as Error).message);
  }
};
