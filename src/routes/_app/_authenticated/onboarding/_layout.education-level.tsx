import { Button } from "@/components/retroui/Button";
import { Select } from "@/components/retroui/Select";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";

export const Route = createFileRoute(
	"/_app/_authenticated/onboarding/_layout/education-level",
)({
	component: EducationLevelComponent,
});

export const educationLevelSchema = z.object({
	educationLevel: z.enum(["sd", "smp", "sma", "kuliah"]),
});

function EducationLevelComponent() {
	const navigate = useNavigate();
	const { data: user } = useQuery(convexQuery(api.users.getCurrentUser, {}));

	const { mutateAsync: completeOnboardingEducationLevelStep, isPending } =
		useMutation({
			mutationFn: useConvexMutation(
				api.app.completeOnboardingEducationLevelStep,
			),
			onSuccess: () => {
				navigate({ to: "/dashboard" });
			},
		});

	const form = useForm({
		defaultValues: {
			educationLevel: "sma",
		},
		onSubmit: async ({ value }) => {
			await completeOnboardingEducationLevelStep({
				educationLevel: value.educationLevel as z.infer<
					typeof educationLevelSchema
				>["educationLevel"],
			});
		},
		validators: {
			onChange: educationLevelSchema,
		},
	});

	useEffect(() => {
		if (user?.alreadyOnboarded) {
			navigate({ to: "/dashboard" });
		}
	}, [user]);

	return (
		<div className="mx-auto flex h-full w-full max-w-96 flex-col items-center justify-center gap-6">
			<div className="flex flex-col items-center gap-2">
				<span className="mb-2 select-none text-6xl">📚</span>
				<h3 className="text-center text-2xl font-medium text-primary">
					Tingkat Pendidikan
				</h3>
				<p className="text-center text-base font-normal">
					Silakan pilih tingkat pendidikan kamu.
				</p>
			</div>
			<form
				className="flex w-full flex-col items-start gap-1"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div className="flex w-full flex-col gap-1.5">
					<label htmlFor="educationLevel" className="sr-only">
						Tingkat Pendidikan
					</label>
					<form.Field
						name="educationLevel"
						children={(field) => (
							<Select
								onValueChange={field.handleChange}
								defaultValue={field.state.value}
							>
								<Select.Trigger className="w-full">
									<Select.Value placeholder="Tingkat Pendidikan" />
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										<Select.Item value="sd">SD</Select.Item>
										<Select.Item value="smp">SMP</Select.Item>
										<Select.Item value="sma">SMA</Select.Item>
										<Select.Item value="kuliah">Kuliah</Select.Item>
									</Select.Group>
								</Select.Content>
							</Select>
						)}
					/>
				</div>

				<div className="flex flex-col">
					{form.state.fieldMeta.educationLevel?.errors.length > 0 && (
						<span className="mb-2 text-sm text-destructive">
							{form.state.fieldMeta.educationLevel?.errors[0].message}
						</span>
					)}
				</div>

				<Button type="submit" size="sm" className="w-full justify-center">
					{isPending ? <Loader2 className="animate-spin" /> : "Selanjutnya"}
				</Button>
			</form>

			<p className="px-6 text-center text-sm font-normal leading-normal text-muted-foreground">
				Anda dapat mengubah tingkat pendidikan Anda kapan saja dari pengaturan
				akun Anda.
			</p>
		</div>
	);
}
