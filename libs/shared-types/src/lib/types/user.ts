import { Role } from "./role";

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  roles: Role[];
}
