import { parseEnvironment } from "../lib/config/env";

try {
  const environment = parseEnvironment();
  console.log(
    `Environment valid for ${environment.NODE_ENV}; database and application URL are configured.`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
