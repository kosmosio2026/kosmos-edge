import { redirect } from 'next/navigation';

export default function ManagerParkingLotApprovalsRedirectPage() {
  redirect('/manager/requests/parking-lots');
}
