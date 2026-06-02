import { createClient } from "tinacms/dist/client";
import { queries } from "./types.js";
export const client = createClient({ cacheDir: '/Users/matt/Developer/personal/wicksipedia.com/tina/__generated__/.cache/1780378011536', url: 'http://localhost:4001/graphql', token: '', queries,  });
export default client;
  