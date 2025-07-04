import app from "./app.js";
import dotenv from "dotenv";

dotenv.config();
const PORT = process.env.SERVER_PORT || 9083;
/* 
@DEMO APP
Assuming we've the database and other fancy things
*/

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
