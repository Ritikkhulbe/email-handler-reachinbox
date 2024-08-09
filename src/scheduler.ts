import { Worker, Job } from 'bullmq';
import { connection, redisGetToken } from './middlewares/redis.middleware';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { parseAndSendoutlookMail } from './controllers/outlookQueue';
import { parseAndSendMail } from './controllers/queueController';

dotenv.config();

interface EmailData {
  from: string;
  to: string;
  id: string;
  token: string;
  jobId: string;
}

const sendEmail = (data: EmailData, jobID: string): Promise<string | void> =>
  new Promise(async (resolve, reject) => {
    try {
      console.log(data);
      const msg = await parseAndSendMail(data, data.token);
      if (msg) {
        console.log(`Job ${jobID} completed and sent to ${data.to}`);
      }
      resolve(msg);
    } catch (error) {
      console.error(error);
      reject(error);
    }
  })
    .then((res) => console.log(res))
    .catch((err) => console.log(err));

const mailWorker = new Worker(
  'email-queue',
  async (job: Job) => {
    const { from, to, id, token, jobId } = job.data as EmailData;

    console.log(`Job ${job.id} has started`);
    setTimeout(async () => {
      await sendEmail(job.data as EmailData, job.id as string);
    }, 5000);
    console.log('Job in progress');
  },
  { connection }
);

const sendoutlookmail = (data: EmailData, jobID: string): Promise<string | void> =>
  new Promise(async (resolve, reject) => {
    try {
      const msg = await parseAndSendoutlookMail(data, data.token);
      if (msg) {
        console.log(`Job ${jobID} completed and sent to ${data.to}`);
      }
      resolve(msg);
    } catch (error) {
      console.error(error);
      reject(error);
    }
  })
    .then((res) => console.log(res))
    .catch((err) => console.log(err));

const outlookmailWorker = new Worker(
  'outlook-queue',
  async (job: Job) => {
    const { from, to, id, jobId } = job.data as EmailData;

    console.log(`Job ${job.id} has started`);
    setTimeout(async () => {
      await sendoutlookmail(job.data as EmailData, job.id as string);
    }, 5000);
    console.log('Job in progress');
  },
  { connection }
);

export { mailWorker, outlookmailWorker };
