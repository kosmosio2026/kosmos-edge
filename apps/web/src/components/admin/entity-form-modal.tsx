'use client';

import { useForm } from 'react-hook-form';

type EntityValues = Record<string, any>;

export function EntityFormModal({
  open,
  title,
  defaultValues,
  fields,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  defaultValues: EntityValues;
  fields: Array<{
    name: string;
    label: string;
    type?: 'text' | 'number' | 'checkbox';
    required?: boolean;
    min?: number;
    max?: number;
    validate?: (value: unknown) => string | true;
  }>;
  onClose: () => void;
  onSubmit: (values: EntityValues) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EntityValues>({
    defaultValues,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30">
      <div className="mx-auto mt-16 w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xl font-semibold">{title}</div>
          <button
            onClick={() => {
              reset(defaultValues);
              onClose();
            }}
            className="rounded-xl border px-3 py-2 text-sm"
          >
            Close
          </button>
        </div>

        <form
          className="space-y-4"
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
            reset(defaultValues);
          })}
        >
          {fields.map((field) => {
            if (field.type === 'checkbox') {
              return (
                <label key={field.name} className="flex items-center gap-3">
                  <input type="checkbox" {...register(field.name)} />
                  <span className="text-sm">{field.label}</span>
                </label>
              );
            }

            return (
              <div key={field.name}>
                <label className="mb-2 block text-sm font-medium">
                  {field.label}
                  {field.required ? ' *' : ''}
                </label>
                <input
                  type={field.type ?? 'text'}
                  className="w-full rounded-2xl border px-4 py-3 text-sm"
                  {...register(field.name, {
                    required: field.required ? `${field.label} is required` : false,
                    valueAsNumber: field.type === 'number',
                    min:
                      field.min !== undefined
                        ? { value: field.min, message: `Minimum ${field.min}` }
                        : undefined,
                    max:
                      field.max !== undefined
                        ? { value: field.max, message: `Maximum ${field.max}` }
                        : undefined,
                    validate: field.validate,
                  })}
                />
                {errors[field.name] ? (
                  <div className="mt-1 text-xs text-red-600">
                    {String(errors[field.name]?.message ?? 'Invalid value')}
                  </div>
                ) : null}
              </div>
            );
          })}

          <button
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}