import { Link } from "react-router";

function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-500">
          Error 404
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-heading sm:text-5xl">
          Page not found
        </h1>

        <p className="mx-auto mt-4 max-w-md leading-7 text-muted">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        <Link
          to="/"
          className="mt-7 inline-flex rounded-xl bg-brand-500 px-5 py-3 font-semibold text-white transition hover:bg-brand-600 active:scale-[0.98]"
        >
          Back to StudyFluxAI
        </Link>
      </div>
    </main>
  );
}

export default NotFoundPage;