import { Request, Response } from 'express';
import { Queue } from 'bullmq';
import { connection, redisGetToken } from '../middlewares/redis.middleware';
import dotenv from 'dotenv';
import axios from 'axios';
import OpenAI from 'openai';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_SECRECT_KEY });

interface MailBody {
  from: string;
  to: string;
  id: string;
  token: string;
}

const sendOutlookMailQueue = new Queue("outlook-queue", { connection });

async function init(body: MailBody): Promise<void> {
  const res = await sendOutlookMailQueue.add(
    "Email to the selected User",
    {
      from: body.from,
      to: body.to,
      id: body.id,
      token: body.token,
    },
    { removeOnComplete: true }
  );
  console.log("Job added to queue", res.id);
}

export const sendOutlookMailViaQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, email } = req.params;
    const { from, to } = req.body;
    const token = await redisGetToken(email);
    console.log(token);
    if(token)
        await init({ from, to, id, token });
    res.send("Mail processing has been queued.");
  } catch (error: any) {
    console.log("Error in sending mail via queue", error.message);
    res.status(500).send("Error in sending mail via queue");
  }
};

interface MailData {
  label: string;
  to: string;
  subject: string;
  textContent: string;
  snippet: string;
}

export const sendoutlookEmail = async (data: MailData, token: string): Promise<any> => {
  console.log(data);
  try {
    if (!token) {
      throw new Error("Token not found, please login again to get token");
    }

    const { label, to, subject, textContent, snippet } = data;

    let emailContent = "";
    if (label === "Interested") {
      emailContent = `Dear user, We're excited to share with you how our product can benefit you:
        - Secure Mailing: Our platform offers end-to-end encryption to ensure your emails remain private and secure.
        - Automated Emails: Easily automate your email workflows by setting timers and triggers. Schedule emails to be sent at specific times or based on user actions.
        - Customizable Templates: Create personalized email templates and automate repetitive tasks, saving you time and effort.
  
        Would you like to learn more about how our platform can streamline your email communication? Feel free to reply to this email.`;
    } else if (label === "Not Interested") {
      emailContent = `Dear user, we would appreciate your feedback on why you are not interested. Please let us know in around 100-150 words.`;
    } else if (label === "More Information") {
      emailContent = `Dear user, thank you for expressing interest in our product! Here are some of its key features:
        - Google Authentication: Allow users to authenticate using their Google accounts.
        - View User Profile: Retrieve and display user profile information such as name, email, and profile picture.
        - View All Drafts: Fetch and display a list of all draft emails associated with the user's email address.
        - Read Specific Email: Retrieve and display the content of a specific email using its ID.
        - List Mails: Fetch and display a list of all emails associated with the user's email address.
        - Send Email with Label: Allow users to send emails with a specified label (e.g., "Interested", "Not Interested", "More Information").`;
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

    const choice = response.choices[0];
    if (!choice || !choice.message || !choice.message.content) {
      throw new Error("No valid response content from OpenAI");
    }

    const content = choice.message.content;
    const [heading, features, benefits] = content.split("\n\n");
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
              address: to,
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

interface ParseMailData {
  from: string;
  to: string;
  id: string;
}

export const parseAndSendoutlookMail = async (data1: ParseMailData, token: string): Promise<any> => {
  try {
    const { from, to, id } = data1;
    if (!token) {
      throw new Error("Token not found, please login again to get token");
    }
    
    const response = await axios.get(`https://graph.microsoft.com/v1.0/me/messages/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const message = response.data;
    const subject = message.subject;
    const body = message.body.content;

    let textContent = body;
    let snippet = message.bodyPreview;

    const emailContext = `${subject} ${snippet} ${textContent}`;
    
    const airesponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0301",
      max_tokens: 60,
      temperature: 0.5,
      messages: [
        {
          role: "user",
          content: `Based on the following text, give a one-word answer categorizing the text based on the content and assign a label from the given options: Interested, Not Interested, More information. Text is: ${emailContext}`,
        },
      ],
    });
    if(!airesponse.choices[0]?.message.content) throw new Error("No openai content found")
    const prediction = airesponse.choices[0]?.message.content.trim();
    console.log("AI Response:", prediction);

    let label;
    switch (prediction) {
      case "Interested":
        label = "Interested";
        break;
      case "Not Interested":
        label = "Not Interested";
        break;
      case "More information":
        label = "More information";
        break;
      default:
        label = "Not Sure";
    }

    const data = {
      subject,
      textContent,
      snippet: message.snippet,
      label,
      from,
      to,
    };
    
    const dataFromMail = await sendoutlookEmail(data, token);
    return dataFromMail;
  } catch (error: any) {
    console.log("Can't fetch email ", error.message);
    throw new Error("Can't parse and send email: " + error.message);
  }
};

