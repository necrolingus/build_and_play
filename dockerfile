FROM node:24-slim

# Set production environment
ENV NODE_ENV=production

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY ["package.json", "package-lock.json*", "./"]

RUN npm ci --omit=dev

# Bundle app source (src/, public/, etc.)
COPY . .

# Express server runs on port 3000 by default
EXPOSE 3000

# Run the app entry point
CMD ["node", "src/server.js"]
