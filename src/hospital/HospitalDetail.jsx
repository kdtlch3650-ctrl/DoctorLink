import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainHeader from "../mainHeader/MainHeader";
import hospitalInfoList from "./data/hospitalInfo";
import "./HospitalDetail.css";

function getHospitalImageSrc(imgurl) {
    if (!imgurl) {
        return "";
    }

    if (/^(https?:)?\/\//.test(imgurl)) {
        return imgurl;
    }

    return `${process.env.PUBLIC_URL}${imgurl}`;
}

export default function HospitalDetail() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const navigate = useNavigate();
    const { id } = useParams();

    const hospital = useMemo(
        () => hospitalInfoList.find((h) => String(h.id) === String(id)),
        [id]
    );

    const reviewsStorageKey = useMemo(() => `hospitalReviews:${String(id)}`, [id]);

    const [reviews, setReviews] = useState([]);
    const [newRating, setNewRating] = useState(5);
    const [newReviewText, setNewReviewText] = useState("");

    const [ratingOverride, setRatingOverride] = useState(null);
    const [reviewCountOverride, setReviewCountOverride] = useState(null);

    // ✅ 예약 모달 (CalendarOverview에 저장)
    const calendarStorageKey = "calendarEvents";
    const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
    const [reserveError, setReserveError] = useState("");
    const [isTimeInputFocused, setIsTimeInputFocused] = useState(false);
    const timeInputRef = useRef(null);
    const [reserveForm, setReserveForm] = useState({
        day: new Date().getDate(),
        dept: "",
        time: "",
    });

    useEffect(() => {
        if (!hospital) return;
        try {
            const raw = localStorage.getItem(reviewsStorageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.reviews)) setReviews(parsed.reviews);
            if (typeof parsed.rating === "number") setRatingOverride(parsed.rating);
            if (typeof parsed.reviewCount === "number") setReviewCountOverride(parsed.reviewCount);
        } catch (e) {
            // ignore
        }
    }, [hospital, reviewsStorageKey]);

    const displayRating = useMemo(() => {
        if (!hospital) return 0;
        const base = parseFloat(hospital.rating);
        const safeBase = Number.isFinite(base) ? base : 0;
        return ratingOverride ?? safeBase;
    }, [hospital, ratingOverride]);

    const displayReviewCount = useMemo(() => {
        if (!hospital) return 0;
        const base = Number(hospital.reviewCount) || 0;
        return reviewCountOverride ?? base;
    }, [hospital, reviewCountOverride]);

    const deleteReviewAt = (idxToDelete) => {
        if (!hospital) return;
        if (idxToDelete < 0 || idxToDelete >= reviews.length) return;
        if (!window.confirm("이 리뷰를 삭제할까요?")) return;

        const target = reviews[idxToDelete];
        const r = Number(target?.rating);
        const prevCount = displayReviewCount;
        const prevAvg = displayRating;
        const baseCount = Number(hospital.reviewCount) || 0;
        const baseAvg = Number.isFinite(parseFloat(hospital.rating))
            ? parseFloat(hospital.rating)
            : 0;

        const nextReviews = reviews.filter((_, i) => i !== idxToDelete);
        const nextCount = Math.max(baseCount, prevCount - 1);

        // 평균 재계산: (prevAvg*prevCount - r) / (prevCount-1)
        // 단, baseCount 이하로는 내려갈 수 없으므로 base 값으로 복원 처리
        let nextAvg = prevAvg;
        if (nextCount <= baseCount) {
            nextAvg = baseAvg;
        } else if (Number.isFinite(r) && prevCount > 1) {
            const nextAvgRaw = (prevAvg * prevCount - r) / (prevCount - 1);
            nextAvg = Math.round(nextAvgRaw * 10) / 10;
        }

        setReviews(nextReviews);

        // 사용자가 남긴 리뷰가 더 이상 없으면 localStorage 오버라이드 제거
        if (nextReviews.length === 0) {
            setRatingOverride(null);
            setReviewCountOverride(null);
            try {
                localStorage.removeItem(reviewsStorageKey);
            } catch (e) {
                // ignore
            }
            return;
        }

        setRatingOverride(nextAvg);
        setReviewCountOverride(nextCount);
        try {
            localStorage.setItem(
                reviewsStorageKey,
                JSON.stringify({
                    rating: nextAvg,
                    reviewCount: nextCount,
                    reviews: nextReviews,
                })
            );
        } catch (e) {
            // ignore
        }
    };

    const naverMapSearchUrl = useMemo(() => {
        if (!hospital) return "#";
        const q = encodeURIComponent(`${hospital.address}`);
        return `https://map.naver.com/p/search/${q}`;
    }, [hospital]);

    useEffect(() => {
        if (!hospital) return;
        // 모달 기본값: 담당과는 병원 진료과로
        setReserveForm((prev) => ({
            ...prev,
            dept: prev.dept || hospital.department || "",
        }));
    }, [hospital]);

    const handleSave = () => {
        if (!hospital) return;

        const dept = reserveForm.dept.trim();
        const time = reserveForm.time;
        const day = Number(reserveForm.day);

        if (!dept) {
            setReserveError("담당과를 입력해주세요.");
            return;
        }
        if (!time) {
            setReserveError("시간을 선택해주세요.");
            return;
        }
        if (!Number.isFinite(day) || day < 1 || day > 31) {
            setReserveError("날짜(일)는 1~31 사이로 입력해주세요.");
            return;
        }

        setReserveError("");

        try {
            const raw = localStorage.getItem(calendarStorageKey);
            const parsed =
                raw && raw !== "null"
                    ? JSON.parse(raw)
                    : {};
            const prevEvents =
                parsed && typeof parsed === "object"
                    ? parsed
                    : {};

            const dayKey = String(day);
            const dayEvents = prevEvents[dayKey] || [];
            const next = {
                ...prevEvents,
                [dayKey]: [
                    ...dayEvents,
                    {
                        type: "reservation",
                        title: `${dept} · ${time}`,
                        hospitalId: hospital.id,
                        hospitalTitle: hospital.title,
                    },
                ],
            };

            localStorage.setItem(
                calendarStorageKey,
                JSON.stringify(next)
            );
        } catch (e) {
            // ignore
        }

        setIsReserveModalOpen(false);
        alert("예약이 달력에 저장됐어요. (캘린더에서 확인)");
    };

    const treatments = useMemo(() => {
        if (!hospital) return [];
        if (Array.isArray(hospital.treatments) && hospital.treatments.length > 0) {
            return hospital.treatments;
        }

        // 데이터에 진료항목이 아직 없을 때를 대비한 기본값(진료과 기반)
        const byDept = {
            "내과": ["감기/독감", "소화기", "만성질환", "건강검진", "예방접종"],
            "치과": ["충치", "스케일링", "임플란트", "교정", "신경치료"],
            "소아청소년과": ["예방접종", "성장", "감기", "알레르기", "영유아 검진"],
            "정형외과": ["관절", "척추", "골절", "스포츠손상", "물리치료"],
            "이비인후과": ["비염", "중이염", "인후염", "어지럼증", "수면/코골이"],
            "안과": ["시력검사", "백내장", "안구건조", "녹내장", "망막"],
            "산부인과": ["임신/산전", "부인과 질환", "피임", "검진", "상담"],
            "피부과": ["여드름", "피부염", "레이저", "색소/미백", "탈모"],
            "재활의학과": ["통증클리닉", "도수치료", "운동치료", "물리치료", "재활"],
            "정신의학과": ["우울/불안", "스트레스", "수면", "상담", "검사"],
            "비뇨기과": ["전립선", "배뇨장애", "요로결석", "검진", "상담"],
            "신경과": ["두통", "어지럼", "손발저림", "치매", "뇌졸중"],
            "신경외과": ["디스크", "척추", "신경통", "비수술치료", "상담"],
            "가정의학과": ["건강검진", "만성질환", "예방접종", "금연", "영양상담"],
            "한의과": ["침/뜸", "추나요법", "한약", "통증치료", "체질상담"],
        };
        return byDept[hospital.department] ?? [];
    }, [hospital]);

    // ✅ HospitalDetail에서는 "내부 스크롤(.hospital-detail-page)"만 사용하도록
    // 바깥(body/html) 스크롤을 잠금 처리
    useEffect(() => {
        const prevBodyOverflow = document.body.style.overflow;
        const prevHtmlOverflow = document.documentElement.style.overflow;
        const mainContentEl = document.querySelector(".main-content");
        const headerEl = document.querySelector("header");

        const prevMainContentOverflow = mainContentEl?.style.overflow;
        const prevMainContentHeight = mainContentEl?.style.height;

        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";

        const syncMainContentHeight = () => {
            if (!mainContentEl) return;
            const headerH = headerEl?.getBoundingClientRect().height ?? 0;
            // main-content가 viewport 안에 정확히 들어오도록 높이를 맞추고,
            // 페이지 내부(.hospital-detail-page)에서만 스크롤되게 한다.
            mainContentEl.style.height = `${window.innerHeight - headerH}px`;
            mainContentEl.style.overflow = "hidden";
        };

        syncMainContentHeight();
        window.addEventListener("resize", syncMainContentHeight);

        return () => {
            document.body.style.overflow = prevBodyOverflow;
            document.documentElement.style.overflow = prevHtmlOverflow;
            window.removeEventListener("resize", syncMainContentHeight);

            if (mainContentEl) {
                mainContentEl.style.overflow = prevMainContentOverflow ?? "";
                mainContentEl.style.height = prevMainContentHeight ?? "";
            }
        };
    }, []);

    return (

        <MainHeader>
            {/* ==================================== add ==================================== */}

            <div className="hospital-detail-page">

                {!hospital ? (
                    <div className="hospital-detail-empty">
                        병원 정보를 찾을 수 없습니다.
                    </div>
                ) : (
                    <div className="hospital-detail-layout">
                        {/* 좌측: 사진 + 상세 정보 */}
                        <section className="hospital-detail-left">
                            <div className="hospital-detail-hero">
                                <img
                                    className="hospital-detail-hero-img"
                                    src={getHospitalImageSrc(hospital.imgurl)}
                                    alt={`${hospital.title} 이미지`}
                                    onError={(e) => {
                                        e.currentTarget.src =
                                            "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1200&q=80";
                                    }}
                                />
                            </div>

                            <div className="hospital-detail-card">
                                <div className="hospital-detail-title-row">
                                    <h1 className="hospital-detail-title">
                                        {hospital.title}
                                    </h1>
                                    <span
                                        className={`hospital-detail-badge ${hospital.isOpenNow
                                            ? "is-open"
                                            : "is-closed"
                                            }`}
                                    >
                                        {hospital.isOpenNow ? "진료중" : "휴진"}
                                    </span>
                                </div>

                                <div className="hospital-detail-section">
                                    <div className="section-title">
                                        병원 소개
                                    </div>
                                    <p className="section-body">
                                        {hospital.description ??
                                            "병원 소개 정보가 아직 없습니다."}
                                    </p>
                                </div>

                                <div className="hospital-detail-alert">
                                    <div className="hospital-detail-alert-text">
                                        <span className="hospital-detail-alert-icon" aria-hidden="true">
                                            !
                                        </span>
                                        해당 병원의 진료시간은 공공데이터를 기반으로 제공되어 실제와 다를 수 있습니다. 방문 전 병원에 문의해주세요.
                                    </div>

                                    <div className="hospital-detail-today-box">
                                        <div className="today-box-row">
                                            <div className="today-box-left">
                                                <span className="today-box-label">오늘</span>{" "}
                                                <span className="today-box-date">
                                                    {(() => {
                                                        const now = new Date();
                                                        const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
                                                        const month = String(now.getMonth() + 1).padStart(2, "0");
                                                        const date = String(now.getDate()).padStart(2, "0");
                                                        const day = weekDays[now.getDay()];
                                                        return `${month}.${date}(${day})`;
                                                    })()}
                                                </span>
                                            </div>

                                            <div className="today-box-right">
                                                <span className="today-box-time">
                                                    {hospital.openTime} ~ {hospital.closeTime}
                                                </span>
                                                <span
                                                    className={`today-box-weekend ${hospital.isWeekendOpen ? "is-ok" : "is-no"
                                                        }`}
                                                >
                                                    {hospital.isWeekendOpen
                                                        ? "주말진료 가능"
                                                        : "주말진료 불가"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="hospital-detail-section">
                                    <div className="section-title">오시는 길</div>
                                    <div className="hospital-detail-direction">
                                        <div className="direction-card">
                                            <div className="direction-pin" aria-hidden="true">
                                                <svg
                                                    className="direction-pin-icon"
                                                    viewBox="0 0 24 24"
                                                    focusable="false"
                                                    aria-hidden="true"
                                                >
                                                    <path d="M12 2c3.86 0 7 3.14 7 7 0 5.02-7 13-7 13S5 14.02 5 9c0-3.86 3.14-7 7-7zm0 9.5A2.5 2.5 0 1 0 12 6.5a2.5 2.5 0 0 0 0 5z" />
                                                </svg>
                                            </div>
                                            <div className="direction-text">
                                                <div className="direction-name">
                                                    {hospital.title}
                                                </div>
                                                <div className="direction-address">
                                                    {hospital.address}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="direction-actions">
                                            <button
                                                type="button"
                                                className="direction-btn is-outline"
                                                onClick={async () => {
                                                    try {
                                                        await navigator.clipboard.writeText(
                                                            hospital.address
                                                        );
                                                        alert("주소를 복사했어요.");
                                                    } catch (e) {
                                                        alert("주소 복사에 실패했어요.");
                                                    }
                                                }}
                                            >
                                                주소 복사
                                            </button>
                                            <a
                                                className="direction-btn is-primary"
                                                href={naverMapSearchUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                네이버지도에서 보기
                                            </a>
                                        </div>

                                        <div className="direction-hint muted">
                                            지도는 새 창에서 열립니다.
                                        </div>
                                    </div>
                                </div>

                                <div className="hospital-detail-section">
                                    <div className="section-title">진료항목</div>
                                    {treatments.length === 0 ? (
                                        <div className="section-placeholder">
                                            진료항목 정보가 아직 없습니다.
                                        </div>
                                    ) : (
                                        <div className="hospital-detail-chips">
                                            {treatments.map((t) => (
                                                <span key={t} className="hospital-detail-chip">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="hospital-detail-section">
                                    <div className="section-title">담당과</div>
                                    <div className="hospital-detail-chips">
                                        <span className="hospital-detail-chip">
                                            {hospital.department}
                                        </span>
                                    </div>
                                </div>

                                <div className="hospital-detail-section">
                                    <div className="section-title">의료진</div>
                                    {Array.isArray(hospital.doctors) && hospital.doctors.length > 0 ? (
                                        <div className="doctor-list">
                                            {hospital.doctors.map((d, idx) => (
                                                <div key={`${d.name ?? "doctor"}-${idx}`} className="doctor-card">
                                                    <div className="doctor-name">
                                                        {d.name}{" "}
                                                        <span className="doctor-role muted">{d.role}</span>
                                                    </div>
                                                    <div className="doctor-specialty">
                                                        {d.specialty}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="section-placeholder">
                                            의료진 정보가 아직 없습니다.
                                        </div>
                                    )}
                                </div>

                                <div className="hospital-detail-section">
                                    <div className="section-title">리뷰</div>

                                    <form
                                        className="review-form"
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            if (!hospital) return;

                                            const r = Number(newRating);
                                            if (!Number.isFinite(r) || r < 1 || r > 5) {
                                                alert("별점은 1~5점으로 입력해주세요.");
                                                return;
                                            }

                                            const text = newReviewText.trim();
                                            if (!text) {
                                                alert("리뷰 내용을 입력해주세요.");
                                                return;
                                            }

                                            const prevCount = displayReviewCount;
                                            const prevAvg = displayRating;
                                            const nextCount = prevCount + 1;
                                            const nextAvgRaw = (prevAvg * prevCount + r) / nextCount;
                                            const nextAvg = Math.round(nextAvgRaw * 10) / 10; // 1자리 반올림

                                            const nextReviews = [
                                                {
                                                    rating: r,
                                                    text,
                                                    createdAt: new Date().toISOString(),
                                                },
                                                ...reviews,
                                            ];

                                            setReviews(nextReviews);
                                            setRatingOverride(nextAvg);
                                            setReviewCountOverride(nextCount);
                                            setNewReviewText("");
                                            setNewRating(5);

                                            try {
                                                localStorage.setItem(
                                                    reviewsStorageKey,
                                                    JSON.stringify({
                                                        rating: nextAvg,
                                                        reviewCount: nextCount,
                                                        reviews: nextReviews,
                                                    })
                                                );
                                            } catch (err) {
                                                // ignore
                                            }
                                        }}
                                    >
                                        <div className="review-form-row">
                                            <label className="review-label">
                                                별점
                                                <span
                                                    className="review-star-bar"
                                                    role="radiogroup"
                                                    aria-label="별점 선택"
                                                >
                                                    {[1, 2, 3, 4, 5].map((v) => (
                                                        <button
                                                            key={v}
                                                            type="button"
                                                            className={`review-star ${v <= newRating ? "is-on" : "is-off"}`}
                                                            aria-label={`별점 ${v}점`}
                                                            aria-checked={newRating === v}
                                                            onClick={() => setNewRating(v)}
                                                        >
                                                            ★
                                                        </button>
                                                    ))}
                                                </span>
                                            </label>

                                            <button type="submit" className="review-submit">
                                                리뷰 등록
                                            </button>
                                        </div>

                                        <textarea
                                            className="review-textarea"
                                            value={newReviewText}
                                            onChange={(e) => setNewReviewText(e.target.value)}
                                            placeholder="리뷰를 작성해 주세요."
                                            rows={3}
                                        />
                                    </form>

                                    {reviews.length === 0 ? (
                                        <div className="section-placeholder">
                                            아직 작성된 리뷰가 없습니다.
                                        </div>
                                    ) : (
                                        <div className="review-list">
                                            {reviews.map((rv, idx) => (
                                                <div key={`${rv.createdAt ?? "x"}-${idx}`} className="review-item">
                                                    <div className="review-item-head">
                                                        <span className="review-item-stars">
                                                            {"★★★★★".slice(0, rv.rating)}
                                                            <span className="review-item-stars-empty">
                                                                {"★★★★★".slice(0, 5 - rv.rating)}
                                                            </span>
                                                        </span>
                                                        <span className="review-item-actions">
                                                            <span className="review-item-date muted">
                                                                {rv.createdAt
                                                                    ? new Date(rv.createdAt).toLocaleDateString()
                                                                    : ""}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="review-delete"
                                                                onClick={() => deleteReviewAt(idx)}
                                                            >
                                                                삭제
                                                            </button>
                                                        </span>
                                                    </div>
                                                    <div className="review-item-text">{rv.text}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* 우측: 요약 + 예약 버튼 (스크롤 따라오기) */}
                        <aside className="hospital-detail-right">
                            <div className="hospital-detail-sticky">
                                <div className="hospital-detail-summary">
                                    <div className="hospital-detail-summary-between">
                                        <div className="summary-title">
                                            {hospital.title}
                                        </div>
                                        <button
                                            type="button"
                                            className="hospital-detail-back"
                                            onClick={() => navigate(-1)}
                                        >
                                            ← 병원리스트
                                        </button>
                                    </div>
                                    <div className="summary-meta">
                                        <div className="summary-row">
                                            <span className="muted">
                                                {hospital.department}
                                            </span>
                                            <span className="dot">•</span>
                                            <span className="muted">
                                                ⭐ {displayRating.toFixed(1)}
                                            </span>
                                        </div>
                                        <div className="summary-row muted">
                                            {hospital.address}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="hospital-detail-cta"
                                    onClick={() => {
                                        if (!hospital) return;
                                        setReserveError("");
                                        setReserveForm((prev) => ({
                                            day: prev.day ?? new Date().getDate(),
                                            dept: hospital.department || prev.dept || "",
                                            time: prev.time || "",
                                        }));
                                        setIsReserveModalOpen(true);
                                    }}
                                >
                                    예약하기
                                </button>

                                <div className="hospital-detail-mini">
                                    <div className="mini-row">
                                        <span className="mini-label">
                                            오늘
                                        </span>
                                        <span className="mini-value">
                                            {hospital.openTime} ~{" "}
                                            {hospital.closeTime}
                                        </span>
                                    </div>
                                    <div className="mini-row">
                                        <span className="mini-label">
                                            상태
                                        </span>
                                        <span className="mini-value">
                                            {hospital.isOpenNow
                                                ? "진료중"
                                                : "휴진"}
                                        </span>
                                    </div>
                                    <div className="mini-row">
                                        <span className="mini-label">
                                            전화
                                        </span>
                                        <span className="mini-value">
                                            {hospital.phone}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                )}
            </div>

            {isReserveModalOpen && hospital && (
                <div
                    className="hospital-modal-overlay"
                    onClick={() => setIsReserveModalOpen(false)}
                >
                    <div
                        className="hospital-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="hospital-modal-title">예약하기</div>

                        {reserveError && (
                            <div className="hospital-modal-error">
                                {reserveError}
                            </div>
                        )}

                        <div className="hospital-modal-field">
                            <label className="hospital-modal-label">담당과</label>
                            <input
                                className="hospital-modal-input"
                                value={reserveForm.dept}
                                onChange={(e) =>
                                    setReserveForm((p) => ({
                                        ...p,
                                        dept: e.target.value,
                                    }))
                                }
                                placeholder="예: 내과"
                            />
                        </div>

                        <div className="hospital-modal-grid">
                            <div className="hospital-modal-field">
                                <label className="hospital-modal-label">
                                    날짜(일)
                                </label>
                                <input
                                    className="hospital-modal-input"
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={reserveForm.day}
                                    onChange={(e) =>
                                        setReserveForm((p) => ({
                                            ...p,
                                            day: Number(e.target.value),
                                        }))
                                    }
                                />
                            </div>
                            <div className="hospital-modal-field">
                                <label className="hospital-modal-label">
                                    시간
                                </label>
                                <input
                                    ref={timeInputRef}
                                    className="hospital-modal-input"
                                    type="time"
                                    value={reserveForm.time}
                                    onChange={(e) =>
                                        setReserveForm((p) => ({
                                            ...p,
                                            time: e.target.value,
                                        }))
                                    }
                                    onFocus={() => setIsTimeInputFocused(true)}
                                    onBlur={() => {
                                        // 약간의 지연을 주어 버튼 클릭 이벤트가 먼저 처리되도록
                                        setTimeout(() => {
                                            setIsTimeInputFocused(false);
                                        }, 150);
                                    }}
                                />
                            </div>
                        </div>

                        <div className={`hospital-modal-actions ${isTimeInputFocused ? "is-left-aligned" : ""}`}>
                            <button
                                type="button"
                                className="hospital-modal-btn is-cancel"
                                onClick={() => {
                                    // 시간 입력 필드가 포커스되어 있으면 blur 처리
                                    if (timeInputRef.current && document.activeElement === timeInputRef.current) {
                                        timeInputRef.current.blur();
                                    }
                                    setIsReserveModalOpen(false);
                                }}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                className="hospital-modal-btn is-confirm"
                                onClick={() => {
                                    // 시간 입력 필드가 포커스되어 있으면 blur 처리 후 저장 로직 실행
                                    if (timeInputRef.current && document.activeElement === timeInputRef.current) {
                                        timeInputRef.current.blur();
                                        // blur 후 저장 로직 실행을 위해 약간의 지연
                                        setTimeout(() => {
                                            handleSave();
                                        }, 100);
                                        return;
                                    }
                                    handleSave();
                                }}
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ==================================== add ==================================== */}
        </MainHeader>
    );
}
