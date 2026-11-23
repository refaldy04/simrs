import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.disable('x-powered-by');

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use((_request, response) => {
  response.status(404).json({ status: 'not_found' });
});

app.listen(port, '0.0.0.0', (error) => {
  if (error) throw error;
  console.log(`SIMRS services listening on port ${port}`);
});
