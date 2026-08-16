function LandingPage() {
  return (
    <main className="min-h-screen bg-page px-6 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center justify-center">
        <div className="w-full max-w-2xl rounded-3xl border border-slate-200/70 bg-white p-8 text-center shadow-sm sm:p-12">
          <img
            src="/studyfluxai-logo.png"
            alt="StudyFluxAI"
            className="mx-auto mb-8 h-auto w-full max-w-md object-contain"
          />

          <h1 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">
            Study smarter with AI.
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Your intelligent learning workspace for quizzes, challenges,
            progress and personalized study experiences.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              className="rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white transition hover:bg-brand-600 active:scale-[0.98]"
            >
              Get Started
            </button>

            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
            >
              Explore StudyFluxAI
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default LandingPage;