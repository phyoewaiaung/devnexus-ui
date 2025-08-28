import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import NavBar from "./Navbar";
import { Outlet } from "react-router-dom";


export default function FeedPageShell() {
    return (
        <div className="min-h-screen bg-muted/20 text-foreground">
            <NavBar />
            <div className="container mx-auto max-w-6xl px-3 md:px-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 py-4 md:py-6">
                    <aside className="hidden md:block md:col-span-3 space-y-4">
                        <LeftRail />
                    </aside>
                    <main className="md:col-span-6 space-y-4">
                        <Outlet />
                    </main>
                    <aside className="hidden lg:block md:col-span-3 space-y-4">
                        <RightRail />
                    </aside>
                </div>
            </div>
            <MobileBottomNav />
        </div>
    );
}

function LeftRail() {
    return (
        <Card className="p-4">
            <div className="mb-3 text-sm font-semibold">Quick links</div>
            <div className="grid gap-2">
                <Button variant="secondary" asChild>
                    <Link to="/" className="justify-start">
                        <Home className="mr-2 h-4 w-4" /> Home
                    </Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link to="/settings/profile" className="justify-start">
                        <Settings className="mr-2 h-4 w-4" /> Settings
                    </Link>
                </Button>
            </div>
        </Card>
    );
}

function RightRail() {
    return (
        <Card className="p-4">
            <div className="mb-3 text-sm font-semibold">Trending tags</div>
            <div className="flex flex-wrap gap-2">
                {["react", "javascript", "node", "css", "devops", "design"].map((tag) => (
                    <Badge key={tag} variant="secondary">#{tag}</Badge>
                ))}
            </div>
        </Card>
    );
}
