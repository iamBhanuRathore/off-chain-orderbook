import { createContext, useState, useContext, ReactNode, Dispatch, SetStateAction, useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";

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
  const location = useLocation();
  const params = useParams();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const userParam = queryParams.get("userId");
    if (userParam) {
      setUser(userParam);
    } else if (params.user) {
      setUser(params.user);
    }
  }, [location.search, params.user]);
  return <UserProviderContext.Provider value={{ user, setUser }}>{children}</UserProviderContext.Provider>;
};
