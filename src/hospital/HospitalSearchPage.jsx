import './HospitalSearchPage.css';
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import MainHeader from "../mainHeader/MainHeader";
import RegionModal from './RegionModal';
import RegionSelectList from './RegionSelectList'
import DepartmentSelectList from './DepartmentSelectList';
import Dropdown from './Dropdown';
import { timeOptions, holidayOptions, openStatusOptions } from './data/dropdownOptions';
import hospitalInfoList from './data/hospitalInfo';

function getHospitalImageSrc(imgurl) {
    if (!imgurl) {
        return "";
    }

    if (/^(https?:)?\/\//.test(imgurl)) {
        return imgurl;
    }

    return `${process.env.PUBLIC_URL}${imgurl}`;
}

export default function HospitalSearchPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [modalType, setModalType] = useState(null);

    // null = 전체(필터 미적용). UI 표시용으로는 기본 라벨(지역/진료과)을 보여줌
    const [region, setRegion] = useState(null);
    const [department, setDepartment] = useState(null);

    // 모바일 페이지에서 진료과 선택 시 필터 적용
    useEffect(() => {
        if (location.state?.department) {
            setDepartment(location.state.department);
        }
    }, [location.state]);
    const [searchQuery, setSearchQuery] = useState("");
    // null = 전체(필터 미적용). UI 표시용으로는 기본 라벨(시간/휴일)을 보여줌
    const [timeFilter, setTimeFilter] = useState(null);
    const [holidayFilter, setHolidayFilter] = useState(null);
    // null = 전체(필터 미적용). UI 표시용으로는 기본 라벨(진료상태)을 보여줌
    const [openStatusFilter, setOpenStatusFilter] = useState(null);

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredHospitalInfoList = hospitalInfoList.filter((hospitalInfo) => {
        const title = (hospitalInfo.title ?? "").toLowerCase();
        const dept = (hospitalInfo.department ?? "").toLowerCase();
        const address = (hospitalInfo.address ?? "").toLowerCase();

        const matchesSearch =
            !normalizedQuery ||
            title.includes(normalizedQuery) ||
            dept.includes(normalizedQuery) ||
            address.includes(normalizedQuery);

        const matchesRegion =
            !region || address.includes(region.toLowerCase());

        const matchesDepartment =
            !department || dept.includes(department.toLowerCase());

        const matchesTime =
            !timeFilter ||
            (timeFilter === "평일 야간" && hospitalInfo.isNight === true) ||
            (timeFilter === "주말 야간" &&
                hospitalInfo.isNight === true &&
                hospitalInfo.isWeekendOpen === true) ||
            (timeFilter === "평일 24시간" &&
                hospitalInfo.openTime === "00:00" &&
                (hospitalInfo.closeTime === "24:00" ||
                    hospitalInfo.closeTime === "23:59")) ||
            (timeFilter === "주말 24시간" &&
                hospitalInfo.isWeekendOpen === true &&
                hospitalInfo.openTime === "00:00" &&
                (hospitalInfo.closeTime === "24:00" ||
                    hospitalInfo.closeTime === "23:59"));

        const matchesHoliday =
            !holidayFilter ||
            ((holidayFilter === "일요일 진료" || holidayFilter === "토요일 진료") &&
                hospitalInfo.isWeekendOpen === true) ||
            (holidayFilter === "공휴일 진료" && hospitalInfo.isHolidayOpen === true);

        const matchesOpenStatus =
            !openStatusFilter ||
            (openStatusFilter === "진료중" && hospitalInfo.isOpenNow === true) ||
            (openStatusFilter === "휴진" && hospitalInfo.isOpenNow === false);

        return (
            matchesSearch &&
            matchesRegion &&
            matchesDepartment &&
            matchesTime &&
            matchesHoliday &&
            matchesOpenStatus
        );
    });

    return (


        <MainHeader>
            {/* ==================================== add ==================================== */}

            <div className={`page ${isOpen ? "modal-open" : ""}`}>
                {/* 상단 고정 헤더 */}
                <div className="page-content">
                    {/* 검색창 */}
                    <div className="hospital-toolbar">
                        <div className='hospital_find'>
                            <div className='item'>
                                <span className="icon" aria-hidden="true">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" strokeWidth="2" />
                                        <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </span>
                                <input
                                    type='text'
                                    placeholder='병원명, 진료과, 지역 검색'
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* 버튼식 필터 */}
                        <div className='btn_filter'>
                            <div className='modal'>
                                <div className="item_top">
                                    <span className="icon" aria-hidden="true">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                            <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                    <button className='select_button' onClick={() => { setModalType("region"); setIsOpen(true); }}>
                                        <span>{region ?? "지역"}</span>
                                        <span className="select-button-arrow" aria-hidden="true">▼</span>
                                    </button>
                                    <button className='select_button' onClick={() => { setModalType("department"); setIsOpen(true) }}>
                                        <span>{department ?? "진료과"}</span>
                                        <span className="select-button-arrow" aria-hidden="true">▼</span>
                                    </button>
                                </div>
                                {/* 드롭다운 */}
                                <div className="item_bottom">
                                    <Dropdown
                                        items={timeOptions}
                                        value={timeFilter}
                                        onChange={setTimeFilter}
                                        placeholder="야간 진료"
                                        nullValueItem="선택 안 함"
                                    />
                                    <Dropdown
                                        items={holidayOptions}
                                        value={holidayFilter}
                                        onChange={setHolidayFilter}
                                        placeholder="휴일"
                                        nullValueItem="선택 안 함"
                                    />
                                    <Dropdown
                                        items={openStatusOptions}
                                        value={openStatusFilter}
                                        onChange={setOpenStatusFilter}
                                        placeholder="진료 상태"
                                        nullValueItem="선택 안 함"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* 병원 목록 */}

                <div className='hospital-list-wrap'>
                    <div className='hospital-list'>
                        {filteredHospitalInfoList.map((hospitalInfo) => (
                            <div
                                className='hospital-card'
                                key={hospitalInfo.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => navigate(`/hospital/${hospitalInfo.id}`)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        navigate(`/hospital/${hospitalInfo.id}`);
                                    }
                                }}
                            >
                                <div className='info'>
                                    <div className='title'>
                                        {hospitalInfo.title}
                                    </div>
                                    <div className='status-row'>
                                        <span className={`isopen ${hospitalInfo.isOpenNow ? "" : "isopen--closed"}`}>
                                            {hospitalInfo.isOpenNow ? '진료중' : '휴진'}
                                        </span>
                                        <span className='font-col-gray'>{hospitalInfo.closeTime} 진료종료</span>
                                    </div>
                                    <div className='locationm-row font-col-gray'>
                                        {hospitalInfo.address}
                                    </div>
                                    <div className='card-meta-row'>
                                        <span className="meta-icon" aria-hidden="true">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                <path
                                                    d="M12 17.3 5.82 21l1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.46 4.73L18.18 21 12 17.3Z"
                                                    fill="currentColor"
                                                />
                                            </svg>
                                        </span>
                                        <span className='font-col-gray'>{hospitalInfo.rating}</span>
                                        <span className='font-col-gray'> • 리뷰 {hospitalInfo.reviewCount}</span>
                                        <span className='font-col-gray'> • {hospitalInfo.department}</span>
                                    </div>
                                </div>
                                <div className="hospital-card-thumb">
                                    <img
                                        src={getHospitalImageSrc(hospitalInfo.imgurl)}
                                        alt={`${hospitalInfo.title} 이미지`}
                                        onError={(e) => {
                                            e.currentTarget.src =
                                                "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=400&q=80";
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                        {filteredHospitalInfoList.length === 0 && (
                            <div className='font-col-gray' style={{ padding: "8px 0" }}>
                                검색 결과가 없습니다.
                            </div>
                        )}
                    </div>
                </div>
                <RegionModal isOpen={isOpen} onClose={() => { setIsOpen(false); }}>
                    {modalType === "region" && (
                        <RegionSelectList
                            onSelect={(value) => {
                                setRegion(value === "전체" ? null : value);
                                setIsOpen(false);
                            }}
                        />
                    )}

                    {modalType === "department" && (
                        <DepartmentSelectList
                            onSelect={(value) => {
                                setDepartment(value === "전체" ? null : value);
                                setIsOpen(false);
                            }}
                        />
                    )}
                </RegionModal>
            </div>
        </MainHeader >

    );
}
