import { ToolLocationPicker } from "@/components/journey/tool-location-picker";

export default function MessagingRegistrationPickerPage() {
  return (
    <ToolLocationPicker
      title="Registration"
      description="Pick a location to view A2P / 10DLC registration status."
      businessPath="reputation/messaging/status"
      openLabel="Registration"
    />
  );
}
