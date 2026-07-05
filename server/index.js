import { createApp } from "./app.js";

const port = process.env.PORT || 5001;

createApp().listen(port, () => {
  console.log(`TaskFlow AI API running on http://localhost:${port}`);
});
