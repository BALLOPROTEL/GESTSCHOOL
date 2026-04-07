type FlipIconButtonProps = {
  buttonClassName: string;
  currentIconSrc: string;
  nextIconSrc: string;
  label: string;
  isFlipping: boolean;
  onClick: () => void;
};

export function FlipIconButton(props: FlipIconButtonProps): JSX.Element {
  const { buttonClassName, currentIconSrc, nextIconSrc, label, isFlipping, onClick } = props;

  return (
    <button
      type="button"
      className={[buttonClassName, "flip-icon-button", isFlipping ? "is-flipping" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <span className="flip-icon-button-shell" aria-hidden="true">
        <span className="flip-icon-button-face flip-icon-button-front">
          <img src={currentIconSrc} alt="" />
        </span>
        <span className="flip-icon-button-face flip-icon-button-back">
          <img src={nextIconSrc} alt="" />
        </span>
      </span>
    </button>
  );
}
