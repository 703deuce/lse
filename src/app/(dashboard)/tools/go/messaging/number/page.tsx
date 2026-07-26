import { ToolLocationPicker } from "@/components/journey/tool-location-picker";

export default function MessagingNumberPickerPage() {
  return (
    <ToolLocationPicker
      title="Phone Number"
      description="Pick a location to manage its dedicated messaging number."
      businessPath="reputation/messaging/number"
      openLabel="Phone Number"
    />
  );
}
