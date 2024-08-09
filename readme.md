To run : <br>
```
npm install 
cd frontend 
npm install 
npm run build 
cd .. 
npm run server
```
<br><br>
Add the following to the .env
```
PORT=3000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback

AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=
OUTLOOK_REDIRECT_URI=http://localhost:3000/oauth2callback/outlook

OPENAI_API_KEY=

REDIS_PORT=6379
REDIS_HOST=127.0.0.1
REDIS_PASS=adsaf
```
<br><br>
After making changes: 
```
npx tsc
npm run server
```
<br><br>
After making changes in frontend(email-oauth):
```
cd frontend
npm run build
cd ..
npm run server
```
<br><br>
Collection for testing:<br>
[link of postman collection](https://www.postman.com/altimetry-candidate-3892980/workspace/assignment/collection/26541602-51e9121d-3394-4b9d-bfb3-d0278843fbd7?action=share&creator=26541602)

Due to some reason openai did not accept my only credit card and i couldn't arrange for any other: so i still 
added the code to ask for promts but then hard coded the mails, I would love to work in ReachInbox ai, 
because first of all I love the product and I know a lot of people are going to be using it in the coming 
future, and secondly I like to work on things from scratch and an opportunity to work in a 
startup is hard to come by.
