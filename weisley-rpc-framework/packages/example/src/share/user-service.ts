export type User = {
  id: number;
  name: string;
};

export type UserService = {
  getUser(id: number): Promise<User>;
  listUsers(): Promise<User[]>;
  getLargeProfile(id: number): Promise<{
    id: number;
    bio: string;
  }>;
};
