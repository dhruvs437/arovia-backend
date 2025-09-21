# Arovia Backend

A robust Node.js API server built with Express, TypeScript, and MongoDB, featuring AI integration, Redis caching, and comprehensive security measures.

## 🚀 Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js with async error handling
- **Database:** MongoDB with Mongoose ODM
- **Cache:** Redis with IORedis client
- **AI Integration:** Groq SDK for AI-powered features
- **Authentication:** JWT with bcryptjs hashing
- **Validation:** Zod for runtime type validation
- **Logging:** Pino with pretty formatting
- **Rate Limiting:** Advanced rate limiting with Redis
- **Web Scraping:** Cheerio for HTML parsing
- **Development:** ts-node-dev with hot reloading

## 📋 Prerequisites

Before running this project, ensure you have:

- Node.js 18+ installed
- MongoDB database (local or cloud)
- Redis server running
- npm or yarn package manager

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd arovia-backend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

## 🔧 Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=5000
API_VERSION=v1

# Database
MONGODB_URI=mongodb://localhost:27017/arovia
MONGODB_TEST_URI=mongodb://localhost:27017/arovia-test

# Redis Cache
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=30d

# Groq AI
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=mixtral-8x7b-32768

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend-domain.com

# Encryption
BCRYPT_SALT_ROUNDS=12

# Logging
LOG_LEVEL=info
```

## 🚦 Getting Started

### Development

Start the development server with hot reloading:

```bash
npm run dev
# or
yarn dev
```

The server will start at `http://localhost:5000` (or your configured PORT).

### Production Build

Build the TypeScript code:

```bash
npm run build
# or
yarn build
```

### Start Production Server

Run the compiled application:

```bash
npm start
# or
yarn start
```

## 📁 Project Structure

```
arovia-backend/
├── src/
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Custom middleware
│   ├── models/           # Mongoose schemas
│   ├── routes/           # API route definitions
│   ├── services/         # Business logic
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript type definitions
│   ├── config/           # Configuration files
│   └── server.ts         # Application entry point
├── dist/                 # Compiled JavaScript (after build)
├── logs/                 # Application logs
├── .env                  # Environment variables
├── .env.example         # Environment template
└── tsconfig.json        # TypeScript configuration
```

## 🔌 API Features

### Core Functionality
- **RESTful API** - Well-structured endpoints following REST principles
- **Authentication & Authorization** - JWT-based auth with refresh tokens
- **Input Validation** - Zod schemas for request validation
- **Error Handling** - Centralized async error handling
- **Rate Limiting** - Intelligent rate limiting with Redis backing
- **CORS** - Configurable cross-origin resource sharing

### Advanced Features
- **AI Integration** - Groq SDK for AI-powered operations
- **Web Scraping** - Cheerio for HTML content extraction
- **Caching Strategy** - Redis for high-performance caching
- **Structured Logging** - Pino logger with pretty development formatting
- **Security** - bcryptjs hashing, CORS protection, rate limiting

### Data & Storage
- **MongoDB Integration** - Mongoose ODM with connection pooling
- **Redis Caching** - IORedis client for distributed caching
- **File Handling** - Support for various content types
- **Schema Validation** - Runtime type checking with Zod

## 🔐 Security Features

- **Password Hashing** - bcryptjs with configurable salt rounds
- **JWT Authentication** - Secure token-based authentication
- **Rate Limiting** - Protection against brute force attacks
- **CORS Configuration** - Controlled cross-origin access
- **Input Sanitization** - Zod validation prevents injection attacks
- **Error Sanitization** - Production-safe error responses

## 📊 Monitoring & Logging

- **Structured Logging** - JSON logs in production, pretty logs in development
- **Request Logging** - Automatic HTTP request/response logging
- **Error Tracking** - Comprehensive error logging and tracking
- **Performance Monitoring** - Response time and resource usage tracking

## 🧪 API Endpoints

### Authentication
```
POST /api/v1/auth/register    # User registration
POST /api/v1/auth/login       # User login
POST /api/v1/auth/refresh     # Refresh JWT token
POST /api/v1/auth/logout      # User logout
```

### Health Check
```
GET /api/v1/health           # Service health status
GET /api/v1/health/detailed  # Detailed health with dependencies
```

## 🚀 Deployment

### Environment Setup
1. Set `NODE_ENV=production` in your environment
2. Configure production MongoDB and Redis instances
3. Set secure JWT secrets and API keys
4. Configure proper CORS origins

### Docker Deployment
```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 5000
CMD ["npm", "start"]
```

### Process Management
Consider using PM2 for production process management:
```bash
npm install -g pm2
pm2 start dist/server.js --name arovia-backend
```

## 🔧 Development Tools

### Hot Reloading
- `ts-node-dev` provides instant TypeScript compilation
- Automatic server restart on file changes
- Transpile-only mode for faster startup

### Code Quality
```bash
# Add these to your package.json scripts
"lint": "eslint src/**/*.ts",
"format": "prettier --write src/**/*.ts",
"type-check": "tsc --noEmit"
```

## 📖 Learn More

### Documentation
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [Redis Commands](https://redis.io/commands)
- [Groq API Documentation](https://console.groq.com/docs)
- [Zod Validation](https://zod.dev/)

### Best Practices
- Follow RESTful API design principles
- Implement proper error handling and logging
- Use environment variables for configuration
- Validate all inputs with Zod schemas
- Implement caching strategies with Redis
- Monitor performance and security metrics

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is private and proprietary.

## 🐛 Troubleshooting

### Common Issues

**MongoDB Connection Issues:**
```bash
# Check MongoDB is running
mongosh --eval "db.adminCommand('ismaster')"
```

**Redis Connection Issues:**
```bash
# Test Redis connection
redis-cli ping
```

**TypeScript Compilation Errors:**
```bash
# Clean build and reinstall
rm -rf dist node_modules
npm install
npm run build
```

**Environment Variables:**
- Ensure all required variables are set in `.env`
- Check for typos in variable names
- Verify file permissions on `.env`

---

Built with ❤️ using Node.js, Express, and modern backend technologies.