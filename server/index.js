import { createApp } from "./app.js";

const port = process.env.PORT || 5010;

createApp().listen(port, () => {
  console.log(`FAU Website Helper API running on http://localhost:${port}`);
});
