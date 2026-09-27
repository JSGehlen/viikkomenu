import { App } from "@/components/App";

export default function Page() {
  return <App serverKey={Boolean(process.env.OPENAI_API_KEY?.trim())} />;
}
