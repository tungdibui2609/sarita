// Render the inbound print page directly so the pretty URL /xhd/:code shows content
// The print page will read slug from window.location.pathname (/xhd/:code)
import PrintInboundPage from "../../print/inbound/page";

export default function XhdPage() {
  return <PrintInboundPage />;
}
