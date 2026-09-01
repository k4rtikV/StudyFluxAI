import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Check,
  LoaderCircle,
  Save,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
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
import { addProgramAndStreamIssues } from "../utils/learningProfileRefinement";
import {
  getLearningProfile,
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
      institutionType !== "board" &&
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

    if (!data.institutionChoice) {
      ctx.addIssue({
        code: "custom",
        path: ["institutionChoice"],
        message:
          institutionType === "board"
            ? "Select your school board."
            : "Select your institution.",
      });
    }

    if (
      data.institutionChoice ===
        OTHER_VALUE &&
      data.customInstitutionName.trim()
        .length < 2
    ) {
      ctx.addIssue({
        code: "custom",
        path: [
          "customInstitutionName",
        ],
        message:
          "Enter the institution name.",
      });
    }

    addProgramAndStreamIssues(data, ctx);
  });

function EditProfilePage() {
  const navigate = useNavigate();

  const [loading, setLoading] =
    useState(true);

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
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

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response =
          await getLearningProfile();

        const profile =
          response.data?.profile;

        if (!active || !profile) {
          return;
        }

        reset({
          educationLevel:
            profile.educationLevel || "",

          institutionState:
            profile.institutionState || "",

          institutionChoice:
            profile.institutionId ||
            profile.institutionKey ||
            "",

          customInstitutionName:
            profile.institutionKey ===
            OTHER_VALUE
              ? profile.institutionName ||
                ""
              : "",

          programChoice:
            profile.programKey ||
            profile.program ||
            "",

          customProgram:
            profile.programKey ===
            OTHER_VALUE
              ? profile.program || ""
              : "",

          streamChoice:
            profile.streamKey ||
            profile.stream ||
            "",

          customStream:
            profile.streamKey ===
            OTHER_VALUE
              ? profile.stream || ""
              : "",
        });
      } catch {
        toast.error(
          "We couldn't load your profile.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [reset]);

  const fieldClass = (hasError) =>
    `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition ${
      hasError
        ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
        : "border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
    }`;

  const resetDownstream = () => {
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

      toast.success(response.message);

      navigate("/profile", {
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
          "Unable to update your profile.",
      );
    }
  };

  if (loading) {
    return (
      <>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <LoaderCircle
              size={28}
              className="mx-auto animate-spin text-brand-500"
            />

            <p className="mt-3 text-sm font-semibold text-slate-500">
              Loading profile...
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <section className="flex items-start gap-3">
        <button
          type="button"
          onClick={() =>
            navigate("/profile")
          }
          className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          aria-label="Back to profile"
        >
          <ArrowLeft size={18} />
        </button>

        <div>
          <p className="text-sm font-bold text-brand-600">
            Account
          </p>

          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-heading">
            Edit learning profile
          </h1>

          <p className="mt-2 max-w-2xl leading-7 text-muted">
            Update the academic defaults StudyFluxAI
            uses for personalized notes, quizzes,
            tutor explanations and recommendations.
          </p>
        </div>
      </section>

      <section className="mt-6 max-w-3xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
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
              value={educationLevel}
              onChange={(event) => {
                setValue(
                  "educationLevel",
                  event.target.value,
                  {
                    shouldValidate: true,
                    shouldTouch: true,
                  },
                );

                resetDownstream();

                if (
                  event.target.value ===
                  "mba"
                ) {
                  setValue(
                    "programChoice",
                    "MBA",
                  );
                }

                if (
                  event.target.value ===
                  "phd"
                ) {
                  setValue(
                    "programChoice",
                    "PhD",
                  );
                }
              }}
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
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>

            {errors.educationLevel && (
              <p className="mt-1.5 text-sm text-rose-600">
                {
                  errors.educationLevel
                    .message
                }
              </p>
            )}
          </div>

          {!boardFlow &&
            educationLevel && (
              <div>
                <label
                  htmlFor="institutionState"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  State / Union Territory
                </label>

                <select
                  id="institutionState"
                  value={institutionState}
                  onChange={(event) => {
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
                  }}
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
                      errors.institutionState
                        .message
                    }
                  </p>
                )}
              </div>
            )}

          {boardFlow &&
            educationLevel && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  School board
                </label>

                <Controller
                  name="institutionChoice"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      options={BOARD_OPTIONS}
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);

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
                      errors.institutionChoice
                        .message
                    }
                  </p>
                )}
              </div>
            )}

          {!boardFlow &&
            institutionState && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  {educationLevel ===
                  "diploma"
                    ? "Diploma institution"
                    : "University / college / institute"}
                </label>

                <Controller
                  name="institutionChoice"
                  control={control}
                  render={({ field }) => (
                    <InstitutionSearchSelect
                      institutions={
                        institutionOptions
                      }
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);

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

                {errors.institutionChoice && (
                  <p className="mt-1.5 text-sm text-rose-600">
                    {
                      errors.institutionChoice
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
                  Enter institution name
                </label>

                <input
                  id="customInstitutionName"
                  type="text"
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
                value={programChoice}
                onChange={(event) => {
                  setValue(
                    "programChoice",
                    event.target.value,
                    {
                      shouldValidate: true,
                      shouldTouch: true,
                    },
                  );

                  setValue(
                    "customProgram",
                    "",
                  );

                  setValue(
                    "streamChoice",
                    "",
                  );

                  setValue(
                    "customStream",
                    "",
                  );
                }}
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

                <option value={OTHER_VALUE}>
                  Other / Not listed
                </option>
              </select>

              {errors.programChoice && (
                <p className="mt-1.5 text-sm text-rose-600">
                  {
                    errors.programChoice
                      .message
                  }
                </p>
              )}
            </div>
          )}

          {programChoice ===
            OTHER_VALUE && (
              <div>
                <label
                  htmlFor="customProgram"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Enter program / degree
                </label>

                <input
                  id="customProgram"
                  type="text"
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
                      errors.customProgram
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
                  value={streamChoice}
                  onChange={(event) => {
                    setValue(
                      "streamChoice",
                      event.target.value,
                      {
                        shouldValidate: true,
                        shouldTouch: true,
                      },
                    );

                    setValue(
                      "customStream",
                      "",
                    );
                  }}
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
                        key={stream}
                        value={stream}
                      >
                        {stream}
                      </option>
                    ),
                  )}

                  <option value={OTHER_VALUE}>
                    Other / Not listed
                  </option>
                </select>

                {errors.streamChoice && (
                  <p className="mt-1.5 text-sm text-rose-600">
                    {
                      errors.streamChoice
                        .message
                    }
                  </p>
                )}
              </div>
            )}

          {streamChoice ===
            OTHER_VALUE && (
              <div>
                <label
                  htmlFor="customStream"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Enter stream / specialization
                </label>

                <input
                  id="customStream"
                  type="text"
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
                      errors.customStream
                        .message
                    }
                  </p>
                )}
              </div>
            )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() =>
                navigate("/profile")
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={17} />
                  Save changes
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <Check
            size={18}
            className="mt-0.5 shrink-0 text-emerald-600"
          />

          <p className="text-sm leading-6 text-emerald-800">
            Changes update the default academic
            context used by future StudyFluxAI
            learning experiences.
          </p>
        </div>
      </section>
    </>
  );
}

export default EditProfilePage;