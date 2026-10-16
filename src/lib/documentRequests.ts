export type DocumentRequest = {
  id: string;
  kind: 'certificate' | 'offer_letter';
  candidate_name: string;
  program_name: string;
  certificate_type: string;
  offer_type: 'Internship Offer' | 'Job Offer' | null;
  designation: string;
  department: string;
  start_date: string | null;
  end_date: string | null;
  details: string;
  status: 'pending' | 'approved' | 'declined' | 'fulfilled';
  admin_note: string;
  created_at: string;
  student_email?: string;
  student_phone?: string | null;
  college_name?: string | null;
  student_department?: string | null;
  batch_id?: string | null;
  batch_name?: string | null;
};

export const requestTitle = (request: DocumentRequest) => request.kind === 'certificate'
  ? `${request.program_name} certificate`
  : request.offer_type || 'Offer letter';

export const requestStatus = (status: DocumentRequest['status']) => ({
  pending: 'Awaiting review', approved: 'Approved', declined: 'Declined', fulfilled: 'Shared by admin',
})[status];
