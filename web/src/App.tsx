import { Routes, Route, Outlet } from "react-router-dom";
import Homepage from "./components/pages/Homepage";
import { Toaster } from "@/components/ui/sonner";
import Header from "@/components/shared/Header";
function App() {
  return (
    <section className="font-body antialiased min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <main className="flex-grow container mx-auto px-4 py-8">
        <Routes>
          <Route
            path="/"
            element={
              <div className="h-dvh flex justify-center items-center">
                <p>Enter a userid, for example: /100</p>
              </div>
            }
          />
          <Route
            path="/:userId"
            element={
              <main>
                <Header />
                <Homepage />
              </main>
            }
          />
        </Routes>
      </main>
      <Toaster />
    </section>
  );
}

export default App;
