export type User = {
  id: number;
  name: string;
};

export type UserService = {
  getUser(id: number): Promise<User>;
  listUsers(): Promise<User[]>;
};
