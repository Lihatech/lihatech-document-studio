export function materialPreviewUrl(url: string): string {
  const link = new URL(url);
  if (link.hostname === 'drive.google.com') {
    const id = link.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1] ?? link.searchParams.get('id');
    if (id) return `https://drive.google.com/file/d/${id}/preview`;
  }
  if (link.hostname === 'docs.google.com') {
    const match = link.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([\w-]+)/);
    if (match) return `https://docs.google.com/${match[1]}/d/${match[2]}/preview`;
  }
  return url;
}
