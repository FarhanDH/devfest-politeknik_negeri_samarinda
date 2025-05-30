import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/_authenticated/quizzes/$quizId/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_app/_authenticated/quizzes/$quizId/"!</div>
}
