import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { LogOut, User } from "lucide-react";

export const LoginButton: React.FC = () => {
  const { user, login, logout, loading } = useAuth();

  if (loading) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-md cursor-not-allowed"
      >
        <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></span>
        Loading...
      </button>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden md:flex items-center gap-2">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || ""}
              className="w-8 h-8 rounded-full border border-gray-200"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <User size={16} className="text-gray-500" />
            </div>
          )}
          <span className="text-sm font-medium text-gray-700 hidden sm:inline-block">
            {user.displayName}
          </span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 p-1.5 md:px-4 md:py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors md:border md:border-red-200"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">Logout</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="flex items-center gap-2 px-6 py-2 bg-white text-gray-800 font-semibold border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-all duration-200"
    >
      <img
        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
        alt="Google Logo"
        className="w-5 h-5"
      />
      <span>Sign in with Google</span>
    </button>
  );
};
