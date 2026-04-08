export { default } from "next-auth/middleware";

export const config = { 
  matcher: [
    "/chat/:path*", 
    "/dashboard/:path*", 
    "/skills/:path*"
  ] 
};
