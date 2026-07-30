const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'Ticket System API',
    description: 'API Documentation for the Helpdesk Ticket System',
    version: '1.0.0'
  },
  host: 'localhost:4000',
  schemes: ['http', 'https']
};

const outputFile = './swagger-output.json';
const endpointsFiles = ['./src/index.js'];

/* NOTE: Generate the swagger-output.json */
swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  console.log('[Swagger] swagger-output.json generated successfully.');
});
