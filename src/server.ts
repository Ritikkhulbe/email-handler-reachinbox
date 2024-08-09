import express, { Request, Response } from 'express';
import session from 'express-session';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import router from './routes/message';
import { googleRouter } from './routes/googleauth';
import outlookRouter from './routes/outlook';

dotenv.config();

const app = express();

app.use(bodyParser.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: 'my_secret',
    resave: false,
    saveUninitialized: false,
  })
);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../frontend/build')));

// API routes
app.use('/', googleRouter);
app.use('/api/mail', router);
app.use('/outlook', outlookRouter);

// The "catchall" handler: for any request that doesn't match one above, send back index.html
app.get('*', async (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port http://localhost:${process.env.PORT}`);
});
