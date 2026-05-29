const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'Ticket System API',
    description: 'API documentation for the Ticket System backend',
    version: '1.0.0',
  },
  host: 'localhost:3000',
  basePath: '/',
  schemes: ['http'],
  consumes: ['application/json'],
  produces: ['application/json'],
  definitions: {
    User: {
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
      role: 'USER',
    },
    Ticket: {
      id: 1,
      title: 'Fix issue',
      description: 'The navbar is broken',
      status: 'OPEN',
      priority: 'MEDIUM',
      userId: 1,
    }
  }
};

const outputFile = './swagger-output.json';
const endpointsFiles = ['./src/index.js'];

swaggerAutogen(outputFile, endpointsFiles, doc);
