import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  BookOpenCheck,
  GraduationCap,
  LoaderCircle,
  LogOut,
  Sparkles,
} from "lucide-react";
import {
  Controller,
  useForm,
} from "react-hook-form";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import { z } from "zod";

import InstitutionSearchSelect from "../components/common/InstitutionSearchSelect";
import SearchableSelect from "../components/common/SearchableSelect";
import {
  INDIA_STATES,
  getInstitutionsForState,
} from "../data/institutionCatalog";
import {
  BOARD_OPTIONS,
  EDUCATION_OPTIONS,
  OTHER_VALUE,
  getInstitutionTypeForLevel,
  getProgramOptions,
  getStreamOptions,
  levelUsesProgram,
  levelUsesStream,
} from "../data/learningCatalog";
import useAuth from "../hooks/useAuth";
import {
  logoutUser,
} from "../services/authService";
import {
  saveLearningProfile,
} from "../services/learningProfileService";

const schema = z
  .object({
    educationLevel: z
      .string()
      .min(
        1,
        "Select your education level.",
      ),

    institutionState: z.string(),

    institutionChoice: z.string(),

    customInstitutionName: z
      .string()
      .trim()
      .max(
        180,
        "Institution name cannot exceed 180 characters.",
      ),

    programChoice: z.string(),

    customProgram: z
      .string()
      .trim()
      .max(
        120,
        "Program cannot exceed 120 characters.",
      ),

    streamChoice: z.string(),

    customStream: z
      .string()
      .trim()
      .max(
        120,
        "Stream cannot exceed 120 characters.",
      ),
  })
  .superRefine((data, ctx) => {
    const institutionType =
      getInstitutionTypeForLevel(
        data.educationLevel,
      );

    if (
      institutionType !== "board"
    ) {
      if (
        !INDIA_STATES.includes(
          data.institutionState,
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["institutionState"],
          message:
            "Select a state or union territory.",
        });
      }
    }

    if (!data.institutionChoice) {
      ctx.addIssue({
        code: "custom",
        path: ["institutionChoice"],
        message:
          institutionType === "board"
            ? "Select your school board."
            : "Select your institution.",
      });
    } else if (
      data.institutionChoice ===
      OTHER_VALUE &&
      data.customInstitutionName
        .trim().length < 2
    ) {
      ctx.addIssue({
        code: "custom",
        path: [
          "customInstitutionName",
        ],
        message:
          institutionType === "board"
            ? "Enter your school board."
            : "Enter your institution name.",
      });
    }

    if (
      levelUsesProgram(
        data.educationLevel,
      )
    ) {
      const programOptions =
        getProgramOptions(
          data.educationLevel,
        );

      if (!data.programChoice) {
        ctx.addIssue({
          code: "custom",
          path: ["programChoice"],
          message:
            "Select your program or degree.",
        });
      } else if (
        data.programChoice ===
        OTHER_VALUE
      ) {
        if (
          data.customProgram
            .trim().length < 2
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["customProgram"],
            message:
              "Enter your program or degree.",
          });
        }
      } else if (
        !programOptions.includes(
          data.programChoice,
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["programChoice"],
          message:
            "Choose a valid program.",
        });
      }
    }

    if (
      levelUsesStream(
        data.educationLevel,
      )
    ) {
      const streamOptions =
        getStreamOptions(
          data.educationLevel,
          data.programChoice ===
            OTHER_VALUE
            ? ""
            : data.programChoice,
        );

      if (!data.streamChoice) {
        ctx.addIssue({
          code: "custom",
          path: ["streamChoice"],
          message:
            "Select your stream or specialization.",
        });
      } else if (
        data.streamChoice ===
        OTHER_VALUE
      ) {
        if (
          data.customStream
            .trim().length < 2
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["customStream"],
            message:
              "Enter your stream or specialization.",
          });
        }
      } else if (
        !streamOptions.includes(
          data.streamChoice,
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["streamChoice"],
          message:
            "Choose a valid stream or specialization.",
        });
      }
    }
  });

const institutionLabel = (
  institutionType,
) => {
  switch (institutionType) {
    case "board":
      return "School board";

    case "university":
      return "University / college / institute";

    case "institution":
      return "Diploma institution";

    default:
      return "Institution";
  }
};

function OnboardingPage() {
  const navigate = useNavigate();

  const {
    user,
    setUser,
    logout,
  } = useAuth();

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      educationLevel: "",
      institutionState: "",
      institutionChoice: "",
      customInstitutionName: "",
      programChoice: "",
      customProgram: "",
      streamChoice: "",
      customStream: "",
    },
  });

  const educationLevel =
    watch("educationLevel");

  const institutionState =
    watch("institutionState");

  const institutionChoice =
    watch("institutionChoice");

  const programChoice =
    watch("programChoice");

  const streamChoice =
    watch("streamChoice");

  const institutionType =
    getInstitutionTypeForLevel(
      educationLevel,
    );

  const boardFlow =
    institutionType === "board";

  const institutionOptions =
    getInstitutionsForState(
      institutionState,
      educationLevel,
    );

  const programOptions =
    getProgramOptions(
      educationLevel,
    );

  const streamOptions =
    getStreamOptions(
      educationLevel,
      programChoice === OTHER_VALUE
        ? ""
        : programChoice,
    );

  const usesProgram =
    levelUsesProgram(
      educationLevel,
    );

  const usesStream =
    levelUsesStream(
      educationLevel,
    );

  const fieldClass = (hasError) =>
    `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition ${
      hasError
        ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
        : "border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
    }`;

  const clearAcademicChoices = () => {
    setValue(
      "institutionState",
      "",
    );

    setValue(
      "institutionChoice",
      "",
    );

    setValue(
      "customInstitutionName",
      "",
    );

    setValue("programChoice", "");
    setValue("customProgram", "");
    setValue("streamChoice", "");
    setValue("customStream", "");

    clearErrors();
  };

  const handleEducationChange = (
    event,
  ) => {
    const nextLevel =
      event.target.value;

    setValue(
      "educationLevel",
      nextLevel,
      {
        shouldValidate: true,
        shouldTouch: true,
      },
    );

    clearAcademicChoices();

    if (nextLevel === "mba") {
      setValue(
        "programChoice",
        "MBA",
      );
    }

    if (nextLevel === "phd") {
      setValue(
        "programChoice",
        "PhD",
      );
    }
  };

  const handleStateChange = (
    event,
  ) => {
    setValue(
      "institutionState",
      event.target.value,
      {
        shouldValidate: true,
        shouldTouch: true,
      },
    );

    setValue(
      "institutionChoice",
      "",
    );

    setValue(
      "customInstitutionName",
      "",
    );
  };

  const handleProgramChange = (
    event,
  ) => {
    setValue(
      "programChoice",
      event.target.value,
      {
        shouldValidate: true,
        shouldTouch: true,
      },
    );

    setValue("customProgram", "");
    setValue("streamChoice", "");
    setValue("customStream", "");
  };

  const onSubmit = async (
    values,
  ) => {
    try {
      const response =
        await saveLearningProfile({
          ...values,

          institutionType:
            getInstitutionTypeForLevel(
              values.educationLevel,
            ),
        });

      setUser(response.data.user);

      toast.success(response.message);

      navigate("/dashboard", {
        replace: true,
      });
    } catch (error) {
      const response =
        error.response?.data;

      if (response?.errors) {
        Object.entries(
          response.errors,
        ).forEach(
          ([field, message]) => {
            setError(field, {
              type: "server",
              message,
            });
          },
        );

        return;
      }

      toast.error(
        response?.message ||
          "Unable to save your learning profile. Please try again.",
      );
    }
  };

  const handleSignOut =
    async () => {
      try {
        await logoutUser();
      } catch {
        // Clear local state even if the request fails.
      }

      logout();

      navigate("/login", {
        replace: true,
      });
    };

  return (
    <main className="min-h-screen bg-page px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <img
            src="/studyfluxai-logo.png"
            alt="StudyFluxAI"
            className="w-44 sm:w-52"
          />

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
          >
            <LogOut size={17} />

            <span className="hidden sm:inline">
              Sign out
            </span>
          </button>
        </header>

        <section className="mt-8 grid overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm lg:grid-cols-[0.85fr_1.15fr]">
          <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 p-7 text-white sm:p-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Sparkles size={24} />
            </div>

            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-100">
              One quick setup
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
              Personalize StudyFluxAI to the way you learn.
            </h1>

            <p className="mt-4 max-w-md leading-7 text-indigo-100">
              Hi{" "}
              {user?.fullName?.split(
                " ",
              )[0] || "there"}
              . Your choices become the default
              academic context for notes, quizzes
              and AI tutor explanations.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex gap-3 rounded-2xl bg-white/10 p-4">
                <GraduationCap
                  size={21}
                  className="mt-0.5 shrink-0"
                />

                <div>
                  <p className="font-semibold">
                    Context-aware choices
                  </p>

                  <p className="mt-1 text-sm leading-6 text-indigo-100">
                    School students only see boards.
                    Diploma learners see diploma
                    institutions. Higher education
                    unlocks colleges, universities
                    and institutes.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 rounded-2xl bg-white/10 p-4">
                <BookOpenCheck
                  size={21}
                  className="mt-0.5 shrink-0"
                />

                <div>
                  <p className="font-semibold">
                    India-wide catalog
                  </p>

                  <p className="mt-1 text-sm leading-6 text-indigo-100">
                    Search a state-aware catalog of
                    1,400+ universities, colleges,
                    institutes and diploma
                    institutions across India.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-10 lg:p-12">
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                  1
                </span>

                <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-full rounded-full bg-brand-500" />
                </div>
              </div>

              <h2 className="mt-6 text-3xl font-bold tracking-tight text-heading">
                Your learning profile
              </h2>

              <p className="mt-2 leading-7 text-muted">
                Each selection controls which choices
                become available next.
              </p>
            </div>

            <form
              onSubmit={handleSubmit(
                onSubmit,
              )}
              noValidate
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="educationLevel"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Education level
                </label>

                <select
                  id="educationLevel"
                  value={
                    educationLevel
                  }
                  onChange={
                    handleEducationChange
                  }
                  aria-invalid={Boolean(
                    errors.educationLevel,
                  )}
                  className={fieldClass(
                    errors.educationLevel,
                  )}
                >
                  <option value="">
                    Select your level
                  </option>

                  {EDUCATION_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>

                {errors.educationLevel && (
                  <p className="mt-1.5 text-sm text-rose-600">
                    {
                      errors
                        .educationLevel
                        .message
                    }
                  </p>
                )}
              </div>

              {educationLevel && (
                <div className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-500">
                    Institution category
                  </p>

                  <p className="mt-1 text-sm font-semibold text-brand-800">
                    {institutionLabel(
                      institutionType,
                    )}
                  </p>
                </div>
              )}

              {educationLevel &&
                !boardFlow && (
                  <div>
                    <label
                      htmlFor="institutionState"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      State / Union Territory
                    </label>

                    <select
                      id="institutionState"
                      value={
                        institutionState
                      }
                      onChange={
                        handleStateChange
                      }
                      aria-invalid={Boolean(
                        errors.institutionState,
                      )}
                      className={fieldClass(
                        errors.institutionState,
                      )}
                    >
                      <option value="">
                        Select state or union territory
                      </option>

                      {INDIA_STATES.map(
                        (state) => (
                          <option
                            key={state}
                            value={state}
                          >
                            {state}
                          </option>
                        ),
                      )}
                    </select>

                    {errors.institutionState && (
                      <p className="mt-1.5 text-sm text-rose-600">
                        {
                          errors
                            .institutionState
                            .message
                        }
                      </p>
                    )}
                  </div>
                )}

              {educationLevel &&
                boardFlow && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      School board
                    </label>

                    <Controller
                      name="institutionChoice"
                      control={control}
                      render={({
                        field,
                      }) => (
                        <SearchableSelect
                          options={
                            BOARD_OPTIONS
                          }
                          value={
                            field.value
                          }
                          onChange={(
                            value,
                          ) => {
                            field.onChange(
                              value,
                            );

                            setValue(
                              "customInstitutionName",
                              "",
                            );
                          }}
                          placeholder="Search or select your board"
                          hasError={Boolean(
                            errors.institutionChoice,
                          )}
                        />
                      )}
                    />

                    {errors.institutionChoice && (
                      <p className="mt-1.5 text-sm text-rose-600">
                        {
                          errors
                            .institutionChoice
                            .message
                        }
                      </p>
                    )}
                  </div>
                )}

              {educationLevel &&
                !boardFlow &&
                institutionState && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      {institutionLabel(
                        institutionType,
                      )}
                    </label>

                    <Controller
                      name="institutionChoice"
                      control={control}
                      render={({
                        field,
                      }) => (
                        <InstitutionSearchSelect
                          institutions={
                            institutionOptions
                          }
                          value={
                            field.value
                          }
                          onChange={(
                            value,
                          ) => {
                            field.onChange(
                              value,
                            );

                            setValue(
                              "customInstitutionName",
                              "",
                            );
                          }}
                          placeholder={
                            educationLevel ===
                            "diploma"
                              ? "Search diploma institutions"
                              : "Search universities, colleges and institutes"
                          }
                          hasError={Boolean(
                            errors.institutionChoice,
                          )}
                        />
                      )}
                    />

                    <p className="mt-1.5 text-xs leading-5 text-slate-500">
                      Showing{" "}
                      {
                        institutionOptions.length
                      }{" "}
                      curated options for{" "}
                      {institutionState}. Can't find
                      yours? Choose Other / Not
                      listed.
                    </p>

                    {errors.institutionChoice && (
                      <p className="mt-1.5 text-sm text-rose-600">
                        {
                          errors
                            .institutionChoice
                            .message
                        }
                      </p>
                    )}
                  </div>
                )}

              {institutionChoice ===
                OTHER_VALUE && (
                <div>
                  <label
                    htmlFor="customInstitutionName"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    {boardFlow
                      ? "Enter your school board"
                      : "Enter your institution name"}
                  </label>

                  <input
                    id="customInstitutionName"
                    type="text"
                    placeholder={
                      boardFlow
                        ? "Enter the full board name"
                        : "Enter the full official institution name"
                    }
                    className={fieldClass(
                      errors.customInstitutionName,
                    )}
                    {...register(
                      "customInstitutionName",
                    )}
                  />

                  {errors.customInstitutionName && (
                    <p className="mt-1.5 text-sm text-rose-600">
                      {
                        errors
                          .customInstitutionName
                          .message
                      }
                    </p>
                  )}
                </div>
              )}

              {usesProgram && (
                <div>
                  <label
                    htmlFor="programChoice"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Program / degree
                  </label>

                  <select
                    id="programChoice"
                    value={
                      programChoice
                    }
                    onChange={
                      handleProgramChange
                    }
                    aria-invalid={Boolean(
                      errors.programChoice,
                    )}
                    className={fieldClass(
                      errors.programChoice,
                    )}
                  >
                    <option value="">
                      Select your program
                    </option>

                    {programOptions.map(
                      (program) => (
                        <option
                          key={program}
                          value={program}
                        >
                          {program}
                        </option>
                      ),
                    )}

                    <option
                      value={
                        OTHER_VALUE
                      }
                    >
                      Other / Not listed
                    </option>
                  </select>

                  {errors.programChoice && (
                    <p className="mt-1.5 text-sm text-rose-600">
                      {
                        errors
                          .programChoice
                          .message
                      }
                    </p>
                  )}
                </div>
              )}

              {usesProgram &&
                programChoice ===
                  OTHER_VALUE && (
                  <div>
                    <label
                      htmlFor="customProgram"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Enter your program / degree
                    </label>

                    <input
                      id="customProgram"
                      type="text"
                      placeholder="e.g. Integrated MSc in Data Science"
                      className={fieldClass(
                        errors.customProgram,
                      )}
                      {...register(
                        "customProgram",
                      )}
                    />

                    {errors.customProgram && (
                      <p className="mt-1.5 text-sm text-rose-600">
                        {
                          errors
                            .customProgram
                            .message
                        }
                      </p>
                    )}
                  </div>
                )}

              {usesStream &&
                (!usesProgram ||
                  programChoice) && (
                  <div>
                    <label
                      htmlFor="streamChoice"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Stream / specialization
                    </label>

                    <select
                      id="streamChoice"
                      value={
                        streamChoice
                      }
                      onChange={(
                        event,
                      ) => {
                        setValue(
                          "streamChoice",
                          event.target
                            .value,
                          {
                            shouldValidate:
                              true,
                            shouldTouch:
                              true,
                          },
                        );

                        setValue(
                          "customStream",
                          "",
                        );
                      }}
                      aria-invalid={Boolean(
                        errors.streamChoice,
                      )}
                      className={fieldClass(
                        errors.streamChoice,
                      )}
                    >
                      <option value="">
                        Select your stream or field
                      </option>

                      {streamOptions.map(
                        (stream) => (
                          <option
                            key={
                              stream
                            }
                            value={
                              stream
                            }
                          >
                            {stream}
                          </option>
                        ),
                      )}

                      <option
                        value={
                          OTHER_VALUE
                        }
                      >
                        Other / Not listed
                      </option>
                    </select>

                    {errors.streamChoice && (
                      <p className="mt-1.5 text-sm text-rose-600">
                        {
                          errors
                            .streamChoice
                            .message
                        }
                      </p>
                    )}
                  </div>
                )}

              {usesStream &&
                streamChoice ===
                  OTHER_VALUE && (
                  <div>
                    <label
                      htmlFor="customStream"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Enter your stream / specialization
                    </label>

                    <input
                      id="customStream"
                      type="text"
                      placeholder="Enter your field of study"
                      className={fieldClass(
                        errors.customStream,
                      )}
                      {...register(
                        "customStream",
                      )}
                    />

                    {errors.customStream && (
                      <p className="mt-1.5 text-sm text-rose-600">
                        {
                          errors
                            .customStream
                            .message
                        }
                      </p>
                    )}
                  </div>
                )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                    Saving profile...
                  </>
                ) : (
                  <>
                    Continue to StudyFluxAI
                    <ArrowRight
                      size={18}
                    />
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-xs leading-5 text-slate-500">
              The catalog is curated rather than exhaustive.
              Other / Not listed remains available for
              institutions and academic options that are
              not yet included.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default OnboardingPage;