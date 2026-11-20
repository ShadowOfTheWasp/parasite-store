import {createHandler} from '../lib/members.mjs';

const handle = createHandler(process.env);
export const GET = handle;
export const POST = handle;
