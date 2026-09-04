import { authkitProxy } from "@workos-inc/authkit-nextjs";

export default authkitProxy({
  redirectUri: requiredEnvironmentVariable("WORKOS_REDIRECT_URI"),
});

export const config = {
  matcher: ["/", "/problems/:path*", "/categories/:path*", "/sign-in", "/callback"],
};

function requiredEnvironmentVariable(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
