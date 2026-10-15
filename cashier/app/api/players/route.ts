import {browserAuth,json} from '@/lib/api';
import {getPlayers} from '@/lib/player-directory';
export async function GET(req:Request){const denied=browserAuth(req);if(denied)return denied;return json({players:await getPlayers()});}
