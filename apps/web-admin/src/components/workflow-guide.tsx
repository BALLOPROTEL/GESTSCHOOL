import { Children, ReactNode, cloneElement, isValidElement } from "react";

import type { WorkflowStepDef } from "../app-types";

type WorkflowGuideProps = {
  title: string;
  steps: WorkflowStepDef[];
  activeStepId: string;
  onStepChange: (stepId: string) => void;
  children: ReactNode;
};

export function WorkflowGuide(props: WorkflowGuideProps): JSX.Element {
  const { title, steps, activeStepId, onStepChange, children } = props;
  const activeStep = steps.find((step) => step.id === activeStepId) || steps[0];

  const walk = (currentNode: ReactNode): ReactNode =>
    Children.map(currentNode, (node) => {
      if (!isValidElement(node)) return node;

      const currentProps = node.props as {
        children?: ReactNode;
        className?: string;
        ["data-step-id"]?: string;
      };

      const nestedChildren = walk(currentProps.children);
      const stepId = currentProps["data-step-id"];
      const isStepNode = typeof stepId === "string" && stepId.length > 0;

      if (!isStepNode) {
        if (nestedChildren !== currentProps.children) {
          return cloneElement(node, { children: nestedChildren });
        }
        return node;
      }

      const isActive = stepId === activeStep.id;
      const className = [currentProps.className, isActive ? "workflow-step-active" : "workflow-hidden"]
        .filter(Boolean)
        .join(" ");

      return cloneElement(node, {
        className,
        "aria-hidden": !isActive,
        "data-active-step": isActive ? "true" : "false",
        children: nestedChildren
      });
    });

  const managedChildren = walk(children);

  return (
    <section className="workflow-shell workflow-shell-compact">
      {steps.length > 1 ? (
        <div className="workflow-tabs" role="tablist" aria-label={title}>
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={step.id === activeStep.id}
              className={`workflow-tab ${step.id === activeStep.id ? "is-active" : ""}`.trim()}
              onClick={() => onStepChange(step.id)}
            >
              {step.title}
            </button>
          ))}
        </div>
      ) : null}
      <div className="workflow-body">{managedChildren}</div>
    </section>
  );
}
