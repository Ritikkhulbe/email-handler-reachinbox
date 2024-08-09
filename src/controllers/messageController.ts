import axios, { AxiosRequestConfig } from "axios";
import express, { Request, Response } from "express";
import { connection, redisGetToken } from "../middlewares/redis.middleware";
import { createConfig } from "../helpers/utils";
import { google } from "googleapis";
import dotenv from "dotenv";
import OpenAI from "openai";
import { OAuth2Client } from "google-auth-library";

dotenv.config();

const oAuth2Client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_SECRECT_KEY });

export const getDrafts = async (req: Request, res: Response): Promise<void> => {
  try {
    const url= `https://gmail.googleapis.com/gmail/v1/users/${req.params.email}/drafts`;
    const token = await redisGetToken(req.params.email);
    console.log(token);

    if (!token) {
      res.send("Token not found, Please login again to get token");
      return;
    }

    const config = createConfig(url, token);
    console.log(config);
    const response = await axios(config);
    console.log(response);
    res.json(response.data);
  } catch (error: any) {
    res.send(error.message);
    console.log("Can't get drafts ", error.message);
  }
};

export const readMail = async (req: Request, res: Response): Promise<void> => {
  try {
    const url = `https://gmail.googleapis.com/gmail/v1/users/${req.params.email}/messages/${req.params.message}`;
    const token = await redisGetToken(req.params.email);

    if (!token) {
      res.send("Token not found, Please login again to get token");
      return;
    }

    const config = createConfig(url, token);
    const response = await axios(config);
    const data = await response.data;
    res.json(data);
  } catch (error: any) {
    res.send(error.message);
    console.log("Can't read mail ", error.message);
  }
};

export const createLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = await redisGetToken(req.params.email);
    const label = req.body;
    console.log(`Token: ${token}`);

    const response = await axios.post(`https://gmail.googleapis.com/gmail/v1/users/${req.params.email}/labels`, label, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });

    res.status(200).json(response.data);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

export const getLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    const url = `https://gmail.googleapis.com/gmail/v1/users/${req.params.email}/labels/${req.params.id}`;
    const token = await redisGetToken(req.params.email);

    if (!token) {
      res.status(400).send("Token not found, please login again to get token");
      return;
    }

    const config: AxiosRequestConfig = {
      method: 'get',
      url,
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    };

    const response = await axios(config);
    res.json(response.data);
  } catch (error: any) {
    console.error("Error:", error.message);
    res.status(500).send(error.message);
  }
};

export const getMails = async (req: Request, res: Response): Promise<void> => {
  try {
    const url = `https://gmail.googleapis.com/gmail/v1/users/${req.params.email}/messages?maxResults=50`;
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

export const parseAndSendMail = async (data1: any): Promise<void> => {
  try {
    console.log("body is :", data1);
    const { from, to } = data1;
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    const message = await gmail.users.messages.get({
      userId: "me",
      id: data1.id,
      format: "full",
    });

    const payload = message.data.payload;

    if(!payload) throw new Error("Payload is undefined");

    const headers = payload.headers;

    if(!headers) throw new Error("Headers is undefinied");

    const subject = headers.find((header) => header.name === "Subject")?.value || "";

    let textContent = "";
    if (payload.parts) {
      const textPart = payload.parts.find((part) => part.mimeType === "text/plain");
      
      if (textPart?.body?.data) {
        textContent = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      }
    } else {
        if(payload?.body?.data)
        textContent = Buffer.from(payload.body.data, "base64").toString("utf-8");
    }

    const snippet = message.data.snippet;
    const emailContext = `${subject} ${snippet} ${textContent}`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0301",
      max_tokens: 60,
      temperature: 0.5,
      messages: [
        {
          role: "user",
          content: `Based on the following text just give one word answer, categorizing the text based on the content and assign a label from the given options: Interested, Not Interested, More information. Text is: ${emailContext}`,
        },
      ],
    });

    const Label = response.choices[0]?.message.content?.trim() || "Not Sure";
    console.log("Possible label:", Label);

    let label = "Not Sure";

    if(Label==="Interested")
        label = "Interested";
    else if (Label==="Not Interested")
        label = "Not Interested";
    else if (Label ==="More information")
        label = "More information";
        

    const data = {
      subject,
      textContent,
      snippet: message.data.snippet,
      label,
      from,
      to,
    };

    await sendMail(data);
  } catch (error: any) {
    console.log("Can't fetch email ", error.message);
  }
};

const sendMail = async (data: any): Promise<void> => {
  // Implement sendMail functionality
};

export default {
  getDrafts,
  readMail,
  getMails,
  parseAndSendMail,
  createLabel,
  getLabel,
};
