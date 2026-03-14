import { Route, Routes } from "react-router-dom";

import { CheckoutPage } from "./pages/CheckoutPage";
import { OrderPage } from "./pages/OrderPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CheckoutPage />} />
      <Route path="/order/:publicOrderId" element={<OrderPage />} />
    </Routes>
  );
}
