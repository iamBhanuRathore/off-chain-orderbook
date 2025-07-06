import { createContext, useState, useContext, ReactNode, Dispatch, SetStateAction } from "react";

type UserProviderType = {
  user: string;
  setUser: Dispatch<SetStateAction<string>>;
};

const UserProviderContext = createContext<UserProviderType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserProviderContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState("");
  return <UserProviderContext.Provider value={{ user, setUser }}>{children}</UserProviderContext.Provider>;
};
