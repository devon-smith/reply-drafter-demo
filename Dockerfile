# Node 22: @supabase/supabase-js needs a global WebSocket (realtime client
# initializes eagerly); Node 20 lacks it and the server crashes at createClient.
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server/index.js"]
