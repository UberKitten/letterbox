export interface FolderInfo {
  id: string;
  displayName: string;
  parentFolderId: string | null;
  unreadItemCount: number;
  totalItemCount: number;
  childFolders?: FolderInfo[];
}

export interface EmailAddress {
  name: string;
  address: string;
}

export interface EmailMessage {
  id: string;
  subject: string;
  from: { emailAddress: EmailAddress };
  receivedDateTime: string;
  body: { contentType: "html" | "text"; content: string };
  isRead: boolean;
  parentFolderId: string;
  flag: { flagStatus: "notFlagged" | "flagged" | "complete" };
  categories: string[];
}

export interface MessageListResponse {
  message: EmailMessage | null;
  totalCount: number;
  index: number;
}

export interface UserInfo {
  displayName: string;
  mail: string;
}

export interface CategoryInfo {
  id: string;
  displayName: string;
  color: string;
}

export type StatusFilter = "unread" | "read" | "flagged" | "all";
