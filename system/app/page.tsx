import { requireChatGPTUser } from './chatgpt-auth';
import RentalApp from './rental-app';
export const dynamic = 'force-dynamic';
export default async function Page() { await requireChatGPTUser('/'); return <RentalApp/>; }
