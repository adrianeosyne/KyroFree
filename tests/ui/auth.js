import { me, useConvexAuth } from "./convex.js";
export const useAuth = () => {
  const auth = useConvexAuth();
  return {
    user: auth.isAuthenticated ? me : null,
    ...auth,
    signIn: async () => {},
    signOut: async () => {},
  };
};
