import OrderBookPanel from "@/components/panels/OrderBookPanel";

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Terminal</h1>
      <OrderBookPanel symbol="BTCUSDT" />
    </main>
  );
}
